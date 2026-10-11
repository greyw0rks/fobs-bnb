// Shared shape for a company-news headline. Lives in a neutral module so the
// client NewsPanel never imports from the server-only /api/news route.
export type NewsItem = {
  title: string;
  link: string;
  source: string | null;
  publishedAt: string | null;
};
