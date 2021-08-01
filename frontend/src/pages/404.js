import * as React from "react"

// styles
const pageStyles = {
  color: "#232129",
  padding: "96px",
  fontFamily: "-apple-system, Roboto, sans-serif, serif",
}
const headingStyles = {
  marginTop: 0,
  marginBottom: 64,
  maxWidth: 320,
}

const paragraphStyles = {
  marginBottom: 48,
}

const NotFoundPage = () => {
  return (
    <main style={pageStyles}>
      <title>Not found</title>
      <h1 style={headingStyles}>Page not found</h1>
      <p style={paragraphStyles}>
        Sorry this page couldn't be found
      </p>
    </main>
  )
}

export default NotFoundPage
