import {
  createTheme,
  type MantineColorsTuple,
  MantineProvider,
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
/**
 * Doing this in a separate file allows us to use the theme in renderToStaticMarkup(
 */

const myColor: MantineColorsTuple = [
  "#ffe9f0",
  "#ffd0dd",
  "#faa0b8",
  "#f66d90",
  "#f2426f",
  "#f1275a",
  "#f1184f",
  "#d70841",
  "#c00038",
  "#a9002f",
];

const theme = createTheme({
  primaryColor: "pink",
  colors: {
    pink: myColor,
  },
  primaryShade: 3,
});

export const MantineProviderWrapper = (props: {
  children: React.ReactNode;
}) => (
  <MantineProvider theme={theme} defaultColorScheme="auto">
    <ModalsProvider>
      <Notifications />
      {props.children}
    </ModalsProvider>
  </MantineProvider>
);
