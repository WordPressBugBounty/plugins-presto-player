import { render, screen } from "@testing-library/react";
import StatCard from "../StatCard";

describe("StatCard", () => {
  it("renders children instead of the value when children are provided", () => {
    render(
      <StatCard label="Engagement" value="should-not-appear">
        <div data-testid="custom-chart">chart</div>
      </StatCard>
    );
    expect(screen.getByTestId("custom-chart")).toBeInTheDocument();
    expect(screen.queryByText("should-not-appear")).not.toBeInTheDocument();
  });

});
