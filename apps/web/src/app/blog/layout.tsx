import { BlogQueryProvider } from "@/components/blog-query-provider";
import type { PropsWithChildren } from "react";

export default function BlogLayout({ children }: PropsWithChildren) {
  return (
    <BlogQueryProvider>
      {children}
    </BlogQueryProvider>
  );
}
