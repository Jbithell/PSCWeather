import { Container } from "@mantine/core";
import { Outlet } from "react-router";
import type { Route } from "./+types/layout";

export default function Page({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <Container mt={"lg"}>
      <Outlet />
    </Container>
  );
}
