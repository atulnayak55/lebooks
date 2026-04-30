export type AppView = "listings" | "inbox" | "mylistings" | "contact" | "privacy";

export const viewPaths: Record<AppView, string> = {
  listings: "/",
  inbox: "/inbox",
  mylistings: "/my-listings",
  contact: "/contact",
  privacy: "/privacy",
};

export function viewFromPath(pathname: string): AppView {
  switch (pathname) {
    case "/inbox":
      return "inbox";
    case "/my-listings":
    case "/mylistings":
      return "mylistings";
    case "/contact":
      return "contact";
    case "/privacy":
      return "privacy";
    default:
      return "listings";
  }
}
