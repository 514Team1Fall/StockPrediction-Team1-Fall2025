import type { User } from "../../../api/src/db/schema";
import {
  Button,
  Flex,
  Heading,
  HStack,
  Link as ChakraLink,
  Text,
} from "@chakra-ui/react";
import { Link as ReactLink } from "react-router-dom";

type NavbarProps = {
  user: User | null;
  handleLogout: () => void;
};

// "as" overwrites default tag
// when clicking link, outline around link stays until clicked somewhere else - fix maybe
export default function Navbar({ user, handleLogout }: NavbarProps) {
  console.log("user after refresh link:", user);
  return (
    <Flex as="nav" p="1rem" alignItems="center" justifyContent="space-between" borderBottomWidth="2px">
       <ChakraLink asChild>
        <ReactLink to="/">
          <Heading size="2xl">Wolves of Cloudstreet</Heading>
        </ReactLink>
      </ChakraLink>

      {user ? (
        <Flex fontWeight="medium" gap={4} justifyContent="center">
          <ChakraLink _hover={{ bg: "gray.100" }} asChild>
            <ReactLink to="/news">News</ReactLink>
          </ChakraLink>
          <ChakraLink _hover={{ bg: "gray.100" }} asChild>
            <ReactLink to="/watchlist">Watchlist</ReactLink>
          </ChakraLink>
          <ChakraLink _hover={{ bg: "gray.100" }} asChild>
            <ReactLink to="/analytics">Analytics</ReactLink>
          </ChakraLink>
        </Flex>
      ) : (
        <></>
      )}

      <HStack gap="1rem">
        <Text>{user?.email ?? "Not Logged In"}</Text>
        {!user ? (
          <> </>
        ) : (
          <Button colorPalette="red" onClick={handleLogout}>
            Logout
          </Button>
        )}
      </HStack>
    </Flex>
  );
}
