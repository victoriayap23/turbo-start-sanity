import {
  type DynamicFetchOptions,
  getDynamicFetchOptions,
  sanityFetch,
  sanityFetchMetadata,
} from "@workspace/sanity/live";
import { queryHomePageData } from "@workspace/sanity/query";
import { draftMode } from "next/headers";
import { Suspense } from "react";

import { PageBuilder } from "@/components/pagebuilder";
import { WaterHero } from "@/components/water-hero";
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

  const { _id, _type, pageBuilder } = homePageData ?? {};

  return (
    <>
      <WaterHero />
      {homePageData && (
        <PageBuilder id={_id} pageBuilder={pageBuilder ?? []} type={_type} />
      )}
    </>
  );
}

function HomeFallback() {
  return <div className="min-h-[50vh]" />;
}
