import { Container, Flex, Spinner } from "@chakra-ui/react";

export default function Loading() {
  return (
    <Container paddingY={8}>
      <Flex justify="center" align="center">
        <Spinner />
      </Flex>
    </Container>
  );
}
