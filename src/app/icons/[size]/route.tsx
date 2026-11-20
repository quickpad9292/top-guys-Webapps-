import { ImageResponse } from "next/og";

const SIZES: Record<string, { size: number; pad: number }> = {
  "192": { size: 192, pad: 0 },
  "512": { size: 512, pad: 0 },
  maskable: { size: 512, pad: 80 },
  apple: { size: 180, pad: 0 },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_req: Request, { params }: RouteContext<"/icons/[size]">) {
  const { size: key } = await params;
  const cfg = SIZES[key] ?? SIZES["512"];
  const { size, pad } = cfg;
  const inner = size - pad * 2;
  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: pad ? "linear-gradient(135deg,#7c3aed,#db2777 55%,#f97316)" : "transparent",
        }}
      >
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: pad ? 0 : inner * 0.28,
            background: "linear-gradient(135deg,#7c3aed,#db2777 55%,#f97316)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={inner * 0.62} height={inner * 0.62} viewBox="0 0 40 40">
            <path d="M28.5 11.2a11 11 0 1 0 0 17.6" fill="none" stroke="white" strokeWidth="4.6" strokeLinecap="round" />
            <circle cx="30" cy="20" r="3.3" fill="white" />
          </svg>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
