import { Text } from "@mantine/core";
import type { Route } from "./+types/index";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Home" }];
}

export default function Page({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <Text>
      Porthmadog Sailing Club Weather Station
      <p>
        Display of the data from the weather station has now moved to{" "}
        <a href="https://www.windguru.cz/station/2973">windguru</a> and{" "}
        <a href="https://www.windy.com/station/pws-f05043fc?52.91711478245152,-4.131985902786256">
          Windy
        </a>{" "}
        and{" "}
        <a href="https://wow.metoffice.gov.uk/observations/details/?site_id=5c09b287-9717-f011-a81b-000d3adc591b">
          MetOffice
        </a>
      </p>
    </Text>
  );
}
