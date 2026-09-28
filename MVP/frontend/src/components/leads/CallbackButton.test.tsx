import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CallbackButton from "./CallbackButton";

function stubFetch(status = 201, body: unknown = { id: 1, reason: "Service Quotation" }) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CallbackButton", () => {
  it("renders a button, not a link to /support", () => {
    render(<CallbackButton reason="Service Quotation">Service Quotation</CallbackButton>);
    expect(screen.getByRole("button", { name: "Service Quotation" })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a form with the reason prefilled from the button", () => {
    render(<CallbackButton reason="Service Quotation">Service Quotation</CallbackButton>);
    fireEvent.click(screen.getByRole("button", { name: "Service Quotation" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((screen.getByLabelText(/reason/i) as HTMLInputElement).value).toBe("Service Quotation");
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/phone/i) as HTMLInputElement).value).toBe("");
  });

  it("lets the visitor edit the prefilled reason and submits what they typed", async () => {
    const fetchMock = stubFetch();
    render(
      <CallbackButton reason="Service Quotation" source="/#services">
        Service Quotation
      </CallbackButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Service Quotation" }));
    fill(/name/i, "Asha Rao");
    fill(/phone/i, "+91 98450 12345");
    fill(/reason/i, "Printing quote for 3 hoardings");
    fireEvent.click(screen.getByRole("button", { name: /request call back/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/leads$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Asha Rao",
      phone: "+91 98450 12345",
      reason: "Printing quote for 3 hoardings",
      source: "/#services",
    });
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/call you back/i));
  });

  it("sends the listing id for a space enquiry", async () => {
    const fetchMock = stubFetch();
    render(
      <CallbackButton reason="Enquiry: MG Road Unipole" listingId={42}>
        Ask About This Space
      </CallbackButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask About This Space" }));
    fill(/name/i, "Asha Rao");
    fill(/phone/i, "9845012345");
    fireEvent.click(screen.getByRole("button", { name: /request call back/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.listing_id).toBe(42);
    expect(body.reason).toBe("Enquiry: MG Road Unipole");
  });

  it("blocks an obviously bad phone number before calling the API", async () => {
    const fetchMock = stubFetch();
    render(<CallbackButton reason="Request Proposal">Request Proposal</CallbackButton>);
    fireEvent.click(screen.getByRole("button", { name: "Request Proposal" }));
    fill(/name/i, "Asha Rao");
    fill(/phone/i, "12345");
    fireEvent.click(screen.getByRole("button", { name: /request call back/i }));

    await waitFor(() => expect(screen.getByText(/valid phone number/i)).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the form open with an error when the API fails", async () => {
    stubFetch(500, { detail: "boom" });
    render(<CallbackButton reason="Request Proposal">Request Proposal</CallbackButton>);
    fireEvent.click(screen.getByRole("button", { name: "Request Proposal" }));
    fill(/name/i, "Asha Rao");
    fill(/phone/i, "9845012345");
    fireEvent.click(screen.getByRole("button", { name: /request call back/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe("Asha Rao");
  });

  it("closes on Escape", () => {
    render(<CallbackButton reason="Request Proposal">Request Proposal</CallbackButton>);
    fireEvent.click(screen.getByRole("button", { name: "Request Proposal" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
