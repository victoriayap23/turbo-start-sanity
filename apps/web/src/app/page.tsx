import {
  type DynamicFetchOptions,
  getDynamicFetchOptions,
  sanityFetch,
  sanityFetchMetadata,
} from "@workspace/sanity/live";
import { queryHomePageData } from "@workspace/sanity/query";
import { draftMode } from "next/headers";
import dynamic from "next/dynamic";
import { Suspense } from "react";

import { PageBuilder } from "@/components/pagebuilder";
import { getSEOMetadata } from "@/lib/seo";

const WaterHero = dynamic(
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

export async function generateMetadata() {
  const { perspective } = await getDynamicFetchOptions();
  const { data: homePageData } = await sanityFetchMetadata({
    query: queryHomePageData,
    perspective,
  });
  return getSEOMetadata({
    title: homePageData?.title ?? homePageData?.seoTitle,
    description: homePageData?.description ?? homePageData?.seoDescription,
    slug: "/",
    contentId: homePageData?._id,
    contentType: homePageData?._type,
  });
}

export default async function Page() {
  const { isEnabled: isDraftMode } = await draftMode();
  if (isDraftMode) {
    return (
      <Suspense fallback={<HomeFallback />}>
        <DynamicHome />
      </Suspense>
    );
  }
  return <CachedHome perspective="published" stega={false} />;
}

async function DynamicHome() {
  const { perspective, stega } = await getDynamicFetchOptions();
  return <CachedHome perspective={perspective} stega={stega} />;
}

async function CachedHome({ perspective, stega }: DynamicFetchOptions) {
  "use cache";
  const { data: homePageData } = await sanityFetch({
    query: queryHomePageData,
    perspective,
    stega,
  });

  return (
    <>
      <WaterHero />
      {homePageData?._id && (
        <PageBuilder
          id={homePageData._id}
          pageBuilder={homePageData.pageBuilder ?? []}
          type={homePageData._type ?? "homePage"}
        />
      )}
    </>
  );
}

function HomeFallback() {
  return <div className="min-h-[50vh]" />;
}
