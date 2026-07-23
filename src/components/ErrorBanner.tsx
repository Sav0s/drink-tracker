"use client";

import { Box, Flex, Text } from "@chakra-ui/react";

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: Props) {
  return (
    <Flex
      bg="rgba(224,83,95,0.10)"
      border="1px solid rgba(224,83,95,0.30)"
      borderRadius="12px"
      p={4}
      alignItems="center"
      gap={3}
      role="alert"
    >
      <Text flex={1} fontSize="14px" color="#e0535f">{message}</Text>
      {onRetry && (
        <Box
          as="button"
          bg="none"
          border="none"
          color="#0468b3"
          fontSize="14px"
          fontWeight="600"
          cursor="pointer"
          flexShrink={0}
          onClick={onRetry}
        >
          Neu laden
        </Box>
      )}
    </Flex>
  );
}
