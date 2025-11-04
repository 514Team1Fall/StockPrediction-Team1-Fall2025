import { Provider } from "@/components/ui/provider"
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { BrowserRouter } from "react-router-dom"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
    {/* unsure how to account for browser extensions that modify a webpage's css lol --> i can make dark mode toggle if light mode is that bad */}
      <Provider forcedTheme="light"> 
        <App />
      </Provider>
    </BrowserRouter>
  </React.StrictMode>,
)