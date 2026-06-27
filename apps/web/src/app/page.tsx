import {
  type DynamicFetchOptions,
  getDynamicFetchOptions,
  sanityFetch,
  sanityFetchMetadata,
} from "@workspace/sanity/live";
import { queryHomePageData } from "@workspace/sanity/query";
import { draftMode } from "next/headers";
import { Suspense } from "react";
import { preload } from "react-dom";

import { PageBuilder } from "@/components/pagebuilder";
import { WaterHeroClient } from "@/components/water-hero-client";
import { getSEOMetadata } from "@/lib/seo";

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

  // Preload the hero image so the browser discovers it immediately
  // from the server-rendered HTML, before any JavaScript runs.
  // This fixes the 2,620ms "resource load delay" on LCP.
  preload(
    "https://cdn.sanity.io/images/o5gqs16l/production/b56fa625c57716afb31b83820bb54acae0b3a901-459x711.webp?fit=max&w=960&h=1200",
    { as: "image", fetchPriority: "high" }
  );

  return (
    <>
      <WaterHeroClient />
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
