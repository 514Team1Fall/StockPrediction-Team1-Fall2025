import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import { checkSession, logout } from "./api/auth_api";
import type { User } from "../../api/src/db/schema";
import PrivateRoutes from "./components/PrivateRoutes";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Watchlist from "./pages/Watchlist";
import News from "./pages/News";
import NewsArticle from "./pages/NewsArticle";
import Analytics from "./pages/Analytics";
import {
  Box,
  Flex,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    verifyLogin();
  }, []);

  // TODO: maybe call this every 5 minutes? just so it automatically logs us out when we're not active as default logout time in cognito is 3mins
  async function verifyLogin() {
    const isUser = await checkSession();
    console.log("user @verifyLogin():", isUser);
    setUser(isUser);
    setLoading(false);
  }

  async function handleLogout() {
    await logout();
    console.log("user logged out?:", user);
    setUser(null);
  }

  if (loading) {
    return (
      <VStack colorPalette="teal">
        <Spinner color="colorPalette.600" />
        <Text color="colorPalette.600">Loading...</Text>
      </VStack>
    );
  }

  return (
    <>
      <Flex direction="column" height="100vh">
        <Navbar user={user} handleLogout={handleLogout} />
        <Box flexGrow={1} width="100%">
          <Routes>
            {/* conditionally renders display based on user logged in status*/}
            <Route element={<PrivateRoutes user={user} />}>
              {/* routes for logged-in users */}
              <Route path="/news" element={<News />} />
              <Route path="/watchlist" element={<Watchlist user={user} />} />
              <Route path="/news/:articleId" element={<NewsArticle />} />
              <Route path="/analytics" element={<Analytics />} />
            </Route>
            {/* route for nonlogged-in users */}
            <Route
              path="/login"
              element={user ? <Navigate to="/news" /> : <Login />}
            />
            {/* route for nonlogged-in users */}
            <Route
              path="*"
              element={<Navigate to={user ? "/news" : "/login"} />}
            />
          </Routes>
        </Box>
      </Flex>
    </>
  );
}

export default App;
