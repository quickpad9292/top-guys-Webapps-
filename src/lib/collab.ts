import * as Y from "yjs";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { fromBase64, toBase64 } from "./utils";

export type Peer = { user_id: string; name: string; color: string };

/**
 * Minimal Yjs provider on top of a private Supabase Realtime channel ("note:<id>").
 * - Every local Yjs update is broadcast to peers.
 * - On join we exchange state vectors so both sides receive whatever they are missing.
 * - Presence tracks who is currently viewing the note.
 * Realtime Authorization policies (see supabase/migrations) restrict the channel to the
 * note owner and its collaborators.
 */
export class SupabaseYProvider {
  private channel: RealtimeChannel | null = null;
  private subscribed = false;
  private destroyed = false;

  constructor(
    private supabase: SupabaseClient,
    private noteId: string,
    public doc: Y.Doc,
    private me: Peer,
    private onPeers: (peers: Peer[]) => void,
    private onStatus?: (s: "connecting" | "live" | "offline") => void,
  ) {
    this.doc.on("update", this.handleLocalUpdate);
  }

  async connect() {
    this.onStatus?.("connecting");
    await this.supabase.realtime.setAuth();
    if (this.destroyed) return;

    const channel = this.supabase.channel(`note:${this.noteId}`, {
      config: {
        private: true,
        broadcast: { self: false },
        presence: { key: `${this.me.user_id}:${Math.random().toString(36).slice(2, 8)}` },
      },
    });
    this.channel = channel;

    channel
      .on("broadcast", { event: "y" }, ({ payload }) => {
        Y.applyUpdate(this.doc, fromBase64(payload.u as string), this);
      })
      .on("broadcast", { event: "sync-req" }, ({ payload }) => {
        const diff = Y.encodeStateAsUpdate(this.doc, fromBase64(payload.sv as string));
        this.send("sync-res", { u: toBase64(diff), sv: toBase64(Y.encodeStateVector(this.doc)) });
      })
      .on("broadcast", { event: "sync-res" }, ({ payload }) => {
        Y.applyUpdate(this.doc, fromBase64(payload.u as string), this);
        const back = Y.encodeStateAsUpdate(this.doc, fromBase64(payload.sv as string));
        if (back.length > 2) this.send("y", { u: toBase64(back) });
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Peer>();
        const seen = new Map<string, Peer>();
        Object.values(state)
          .flat()
          .forEach((p) => {
            if (p.user_id && p.user_id !== this.me.user_id) seen.set(p.user_id, p);
          });
        this.onPeers([...seen.values()]);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          this.subscribed = true;
          this.onStatus?.("live");
          await channel.track(this.me);
          this.send("sync-req", { sv: toBase64(Y.encodeStateVector(this.doc)) });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          this.subscribed = false;
          this.onStatus?.("offline");
        }
      });
  }

  private handleLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return; // came from the network
    this.send("y", { u: toBase64(update) });
  };

  private send(event: string, payload: Record<string, unknown>) {
    if (!this.channel || !this.subscribed) return;
    void this.channel.send({ type: "broadcast", event, payload });
  }

  destroy() {
    this.destroyed = true;
    this.doc.off("update", this.handleLocalUpdate);
    if (this.channel) {
      void this.channel.untrack();
      void this.supabase.removeChannel(this.channel);
    }
    this.channel = null;
  }
}
