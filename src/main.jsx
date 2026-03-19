import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/utilities.css";
import "./styles/tasks.css";
import "./styles/auth.css";
import "./styles/collaboration.css";
import "./styles/interaction.css";
import "./styles/community.css";
import "./styles/commerce.css";
import "./styles/courses.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
