import { Flex, Spinner } from "@chakra-ui/react";

/**
 * Centered loading spinner used in place of content that hasn't finished
 * its initial fetch yet (avoids flashing "0,00 €" / empty lists/tables).
 */
export function LoadingState({
  minH = "160px",
  color = "#0468b3",
}: {
  minH?: string;
  /** Spinner color — defaults to brand blue; pass "#6478a0" (steel) on admin screens. */
  color?: string;
}) {
  return (
    <Flex minH={minH} alignItems="center" justifyContent="center" py={8}>
      <Spinner size="lg" color={color} />
    </Flex>
  );
}
