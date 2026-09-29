import { useLocalSearchParams } from "expo-router";
import { MarketplaceItemBody } from "../../../src/screens/MarketplaceItemBody";

export default function MarketplaceItemScreen() {
  const { category, id } = useLocalSearchParams<{ category: string; id: string }>();
  return <MarketplaceItemBody category={category} id={id} />;
}
