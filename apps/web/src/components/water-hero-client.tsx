"use client";

import dynamic from "next/dynamic";

const WaterHeroLazy = dynamic(
  () => import("@/components/water-hero").then((mod) => mod.WaterHero),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: "100%",
          height: "100vh",
          minHeight: "560px",
          background: "#0d2830",
        }}
        aria-hidden="true"
      />
    ),
  }
);

export function WaterHeroClient() {
  return <WaterHeroLazy />;
}
