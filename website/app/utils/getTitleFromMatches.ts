import { useMatches } from "react-router";

export const getTitleFromMatches = () => {
  const matches = useMatches() as {
    handle?: {
      title?: string;
    };
  }[];
  const titles = matches
    .filter((match) => {
      if (
        typeof match.handle !== "undefined" &&
        match.handle !== null &&
        match.handle.hasOwnProperty("title")
      ) {
        return true;
      } else return false;
    })
    .map((match) => {
      if (
        typeof match.handle !== "undefined" &&
        match.handle !== null &&
        match.handle.hasOwnProperty("title")
      ) {
        return match.handle.title;
      }
    });
  return titles.join(" | ");
};
