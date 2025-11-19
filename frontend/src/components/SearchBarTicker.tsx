import {
  Combobox,
  HStack,
  Portal,
  Span,
  Spinner,
  useListCollection,
} from "@chakra-ui/react";
import { useState } from "react";
import { useAsync } from "react-use";
import type { Ticker } from "../../../api/src/db/schema";
import { searchTicker } from "@/api/ticker_api";

export default function SearchBarTicker({
  onSelect,
  watchlistSymbols,
}: {
  onSelect: (symbol: string) => void;
  watchlistSymbols: string[];
}) {
  const [inputValue, setInputValue] = useState("");
  const [selectedValue, setSelectedValue] = useState<string[]>([]); // Add this

  const { collection, set } = useListCollection<Ticker>({
    initialItems: [],
    itemToString: (item) => item.symbol,
    itemToValue: (item) => item.symbol,
  });

  const state = useAsync(async () => {
    // console.log("Collection items:", collection.items);
    // console.log("Collection size:", collection.items?.length);
    // console.log("input val: ", inputValue)
    if (!inputValue || inputValue.length < 1) {
      set([]);
      return;
    }
    const response = await searchTicker(inputValue.toUpperCase());
    // console.log("response from searchTicker but is it ticker?: ", response);
    if (!response) {
      set([]);
    } else {
      set([response]); // collections needs this
    }
  }, [inputValue, set]);

  function handleTickerClick(symbol: string) {
    // console.log("Item clicked:", symbol);
    onSelect(symbol);
    setInputValue("");
    set([]);
    setSelectedValue([]); // Add this here too
  }

  return (
    <Combobox.Root
      width="320px"
      collection={collection}
      placeholder="Search Ticker(s)"
      value={selectedValue} // Control the selected value
      onValueChange={(e) => setSelectedValue(e.value)} // Update when changed
      //  onInputValueChange={(e) => setInputValue(e.inputValue)}
      onInputValueChange={(e) => setInputValue(e.inputValue)}
      //   onValueChange={(e) => {
      //     if (e.value.length > 0) {
      //         console.log("collect iteDSJIAJIJIAIJDmsrrrrrr: ", collection.items)
      //         console.log("iteerrerem: ", inputValue)
      //         // const selectedTicker = collection.items.find(
      //             // t => t.symbol === e.value[2] //getting symbol from array of ticker(s?)
      //         // )
      //         // if (selectedTicker) {
      //         onSelect(e.value[0]); // Pass the symbol, not tickerId
      //         setInputValue("");
      //         // set([])
      //         // }
      //     }
      //   }}
      positioning={{ sameWidth: false, placement: "bottom-start" }}
    >
      <Combobox.Label>Ticker Search</Combobox.Label>

      <Combobox.Control>
        <Combobox.Input placeholder="Enter a ticker (e.g. BTC, MSFT)" />
        <Combobox.IndicatorGroup>
          <Combobox.ClearTrigger />
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>

      <Portal>
        <Combobox.Positioner>
          <Combobox.Content minW="sm">
            {state.loading ? (
              <HStack p="2">
                <Spinner size="xs" borderWidth="1px" />
                <Span>Loading...</Span>
              </HStack>
            ) : state.error ? (
              <Span p="2" color="fg.error">
                Ticker not found
              </Span>
            ) : collection.items?.length === 0 && inputValue ? (
              <Span p="2" color="fg.muted">
                Ticker not found
              </Span>
            ) : (
              collection.items?.map((ticker) => (
                <Combobox.Item
                  key={ticker.tickerId}
                  item={ticker}
                  onClick={() => handleTickerClick(ticker.symbol)}
                >
                  <HStack justify="space-between" textStyle="sm">
                    <Span fontWeight="medium" truncate>
                      {ticker.symbol}
                    </Span>
                    <Span color="fg.muted" truncate>
                      ({ticker.type})
                    </Span>
                  </HStack>
                  {watchlistSymbols.includes(ticker.symbol) && (
                    <Combobox.ItemIndicator />
                  )}
                </Combobox.Item>
              ))
            )}
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
}
