module.exports = {
  siteMetadata: {
    siteUrl: "https://weather.port-tides.com/",
    title: "Porthmadog Sailing Club Weather Station",
  },
  plugins: [
    "gatsby-plugin-react-helmet",
    "gatsby-plugin-sitemap",
    {
      resolve: "gatsby-plugin-manifest",
      options: {
        icon: "src/images/icon.png",
      },
    },
  ],
};
