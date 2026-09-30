jest.mock("../../api/client", () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return { getWallet: jest.fn(), purchaseWithCoins: jest.fn(), ApiError };
});

jest.mock("../../auth/biometricLock", () => ({
  isBiometricLockAvailable: jest.fn(),
  unlockWithBiometrics: jest.fn(),
}));

import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { PurchaseSheet, type PurchaseSheetItem } from "../PurchaseSheet";
import { getWallet, purchaseWithCoins, ApiError } from "../../api/client";
import { isBiometricLockAvailable, unlockWithBiometrics } from "../../auth/biometricLock";

const mockGetWallet = getWallet as jest.Mock;
const mockPurchase = purchaseWithCoins as jest.Mock;
const mockBiometricAvailable = isBiometricLockAvailable as jest.Mock;
const mockUnlock = unlockWithBiometrics as jest.Mock;

const THEME: PurchaseSheetItem = { target: "marketplace_listing", id: "l1", title: "Dark theme", price: 10 };

function walletWith(total: number) {
  return { coinBalance: total, balance: { spendable: total, restricted: 0, total }, history: [] };
}

// The sheet is the last step before a coin charge: it must never buy
// without an explicit confirm, must refuse when the balance is short, and
// must treat a server 409 ("already owned") as success, not a failure.
describe("PurchaseSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBiometricAvailable.mockResolvedValue(false);
  });

  it("shows the balance after purchase and buys only on confirm", async () => {
    mockGetWallet.mockResolvedValue(walletWith(25));
    mockPurchase.mockResolvedValue({ ok: true, target: "marketplace_listing", free: false });
    const onPurchased = jest.fn();

    const { findByText, getByLabelText } = await render(<PurchaseSheet item={THEME} onClose={jest.fn()} onPurchased={onPurchased} />);

    expect(await findByText("25 coins")).toBeTruthy();
    expect(await findByText("15 coins")).toBeTruthy();
    expect(mockPurchase).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText("Buy Dark theme for 10 coins"));

    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith({ target: "marketplace_listing", id: "l1" }));
    await waitFor(() => expect(onPurchased).toHaveBeenCalledTimes(1));
  });

  it("disables buying when the balance is short", async () => {
    mockGetWallet.mockResolvedValue(walletWith(4));

    const { findByText, getByLabelText } = await render(<PurchaseSheet item={THEME} onClose={jest.fn()} onPurchased={jest.fn()} />);

    expect(await findByText("6 coins short")).toBeTruthy();
    await fireEvent.press(getByLabelText("Buy Dark theme for 10 coins"));
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it("does not buy when the biometric prompt is cancelled", async () => {
    mockGetWallet.mockResolvedValue(walletWith(25));
    mockBiometricAvailable.mockResolvedValue(true);
    mockUnlock.mockResolvedValue(false);

    const { findByText, getByLabelText } = await render(<PurchaseSheet item={THEME} onClose={jest.fn()} onPurchased={jest.fn()} />);
    await findByText("25 coins");
    await fireEvent.press(getByLabelText("Buy Dark theme for 10 coins"));

    await waitFor(() => expect(mockUnlock).toHaveBeenCalled());
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it("treats a 409 (already owned) as a completed purchase", async () => {
    mockGetWallet.mockResolvedValue(walletWith(25));
    mockPurchase.mockRejectedValue(new ApiError("You already own this listing.", 409));
    const onPurchased = jest.fn();

    const { findByText, getByLabelText, queryByText } = await render(
      <PurchaseSheet item={THEME} onClose={jest.fn()} onPurchased={onPurchased} />
    );
    await findByText("25 coins");
    await fireEvent.press(getByLabelText("Buy Dark theme for 10 coins"));

    await waitFor(() => expect(onPurchased).toHaveBeenCalledTimes(1));
    expect(queryByText("You already own this listing.")).toBeNull();
  });

  it("shows the server's error and stays open when the purchase fails", async () => {
    mockGetWallet.mockResolvedValue(walletWith(25));
    mockPurchase.mockRejectedValue(new ApiError("This listing isn't available for purchase.", 400));
    const onPurchased = jest.fn();

    const { findByText, getByLabelText } = await render(<PurchaseSheet item={THEME} onClose={jest.fn()} onPurchased={onPurchased} />);
    await findByText("25 coins");
    await fireEvent.press(getByLabelText("Buy Dark theme for 10 coins"));

    expect(await findByText("This listing isn't available for purchase.")).toBeTruthy();
    expect(onPurchased).not.toHaveBeenCalled();
  });

  it("claims a free item without loading the wallet or prompting biometrics", async () => {
    mockPurchase.mockResolvedValue({ ok: true, target: "marketplace_listing", free: true });
    mockBiometricAvailable.mockResolvedValue(true);
    const onPurchased = jest.fn();

    const { getByLabelText } = await render(
      <PurchaseSheet item={{ ...THEME, price: null }} onClose={jest.fn()} onPurchased={onPurchased} />
    );
    await fireEvent.press(getByLabelText("Get Dark theme for free"));

    await waitFor(() => expect(onPurchased).toHaveBeenCalledTimes(1));
    expect(mockGetWallet).not.toHaveBeenCalled();
    expect(mockUnlock).not.toHaveBeenCalled();
  });
});
