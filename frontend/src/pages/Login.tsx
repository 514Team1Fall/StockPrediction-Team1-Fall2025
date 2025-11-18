import { API_URL } from "@/assets/config";
import { Button, Flex, Heading, Text, VStack } from "@chakra-ui/react";

export default function Login() {
  // hmmmm
  function handleLogin() {
    window.location.href = `${API_URL}/api/auth/login`;
  }

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      width="100%"
      height="100%"
      bg="gray.100"
    >
      <VStack gap="1.2rem">
        <Heading textStyle="4xl">Wolves of Cloudstreet</Heading>
        <Text textStyle="lg" color="gray.600">
          Start tracking stock & crypto sentiment
        </Text>
        <Button size="lg" onClick={handleLogin}>
          Login / Sign Up
        </Button>
      </VStack>
    </Flex>
  );
}
