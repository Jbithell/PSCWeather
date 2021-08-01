import * as React from "react"
import Chart from "react-google-charts";
import { Helmet } from "react-helmet"
import Gauge from "./../components/gauge"

const descriptionStyle = {
  color: "#232129",
  fontSize: 14,
  marginTop: 10,
  marginBottom: 0,
  lineHeight: 1.25,
}
//https://github.com/keanemind/react-gaugejs
// markup
const IndexPage = () => {
  return (
    <>
      <Helmet htmlAttributes={{ lang: "en" }}>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1"></meta>
        <meta name="description" content="Porthmadog Sailing Club Weather Station for getting Wind Data"/>
        <title>Porthmadog Sailing Club - Weather Station</title>
        <link rel="canonical" href="https://weather.port-tides.com" />
      </Helmet>
      <title>Home Page</title>
      <Gauge
          value={750}
          minValue={0}
          maxValue={360}
          animationSpeed={32}
          options={{
            "units": "Direction",
            "major-ticks": "N,NE,E,SE,S,SW,W,NW,N",
            "minor-ticks": "22",
            "ticks-angle": "360",
            "start-angle": "180",
            "stroke-ticks":false,
            "color-plate": "#eee",
            "color-needle": "rgba(255, 0, 0, 1)",
            "color-needle-end": "rgba(255, 0, 0, 0.9)",
            "value-box": false,
            "value-text-shadow": false,
            "needle-circle-size": "15",
            "needle-circle-outer": false,
            "animation-rule": "linear",
            "needle-type": "line",
            "needle-start": "75",
            "needle-end": "99",
            "needle-width": "3",
            "borders": false,
            "needle-type": "arrow",
            "animation-duration": "500",
            "highlights":[{"from": 225, "to": 22.5, "color": "rgba(255, 133, 26, 0.4)"}]
          }}
          radial-gauge
          className='gauge-canvas'
          style={{height: '150px'}}
      />
    </>
  )
}

export default IndexPage
