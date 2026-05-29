import { render, screen } from "@testing-library/react";
import BulkActions from "../BulkActions";

describe("BulkActions selectedLabel", () => {
  const noop = () => {};

  it("falls back to the default 'media selected' label when selectedLabel is not provided", () => {
    render(
      <BulkActions
        selected={[1, 2, 3]}
        onDelete={noop}
        onStatusChange={noop}
        onCancel={noop}
      />
    );
    expect(screen.getByText(/3 media selected/)).toBeInTheDocument();
  });

  it("renders the consumer-provided selectedLabel verbatim", () => {
    render(
      <BulkActions
        selected={[1, 2, 3]}
        selectedLabel="3 email submissions selected"
        onDelete={noop}
        onStatusChange={noop}
        onCancel={noop}
      />
    );
    expect(screen.getByText("3 email submissions selected")).toBeInTheDocument();
    expect(screen.queryByText(/media selected/)).not.toBeInTheDocument();
  });

  it("falls back to the default label when selectedLabel is an empty string", () => {
    render(
      <BulkActions
        selected={[1, 2]}
        selectedLabel=""
        onDelete={noop}
        onStatusChange={noop}
        onCancel={noop}
      />
    );
    expect(screen.getByText(/2 media selected/)).toBeInTheDocument();
  });
});
