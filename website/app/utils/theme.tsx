import {
  createTheme,
  type MantineColorsTuple,
  MantineProvider,
} from "@mantine/core";
/**
 * Doing this in a separate file allows us to use the theme in renderToStaticMarkup(
 */

const myColor: MantineColorsTuple = [
  "#ffe9e9",
  "#ffd0d0",
  "#fd9d9d",
  "#fc6766",
  "#fc3b38",
  "#fc231c",
  "#fd160e",
  "#e20a03",
  "#c90000",
  "#b00000",
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
    {props.children}
  </MantineProvider>
);
