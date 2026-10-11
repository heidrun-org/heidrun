import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ConfirmButton from "./ConfirmButton.vue";
import { answerConfirm, confirmDialog } from "../stores/confirm";

describe("ConfirmButton", () => {
  const props = { confirmLabel: "Close", question: "Close this pane?", label: "Close" };

  it("emits confirm only after the user confirms", async () => {
    const wrapper = mount(ConfirmButton, { props });
    await wrapper.get("button").trigger("click");
    expect(confirmDialog.open).toBe(true);
    expect(wrapper.emitted("confirm")).toBeUndefined();
    answerConfirm(true);
    await flushPromises();
    expect(wrapper.emitted("confirm")).toHaveLength(1);
  });

  it("does not emit confirm when the user cancels", async () => {
    const wrapper = mount(ConfirmButton, { props });
    await wrapper.get("button").trigger("click");
    answerConfirm(false);
    await flushPromises();
    expect(wrapper.emitted("confirm")).toBeUndefined();
  });
});
