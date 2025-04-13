import "@mantine/charts/styles.css";
import {
  Button,
  ColorSchemeScript,
  Container,
  Group,
  Text,
  Title,
} from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";

import type React from "react";
import classes from "./utils/ErrorBoundary.module.css";
import { MantineProviderWrapper } from "./utils/theme";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <MantineProviderWrapper>{children}</MantineProviderWrapper>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export const links: Route.LinksFunction = () => [];

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Error";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }
  console.log(error); // Send error to CF workers dashboard

  return (
    <Container className={classes.root}>
      <Title className={classes.title}>{message}</Title>
      <Text c="dimmed" size="lg" ta="center" className={classes.details}>
        {process.env.NODE_ENV !== "production" ? stack : details}
      </Text>
      <Group justify="center">
        <Link reloadDocument to="/">
          <Button variant="subtle" size="md">
            Take me back to home page
          </Button>
        </Link>
      </Group>
    </Container>
  );
}
