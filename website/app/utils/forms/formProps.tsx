export const formInputProps = (
  actionData: any,
  navigationState: "idle" | "loading" | "submitting",
  props: {
    name: string;
    required?: boolean;
  },
) => {
  let errorsArray = [];
  if (
    typeof actionData !== "undefined" &&
    typeof actionData === "object" &&
    actionData.hasOwnProperty("errors") &&
    actionData.errors.hasOwnProperty(props.name) &&
    Array.isArray(actionData?.errors[props.name]?._errors) &&
    actionData?.errors[props.name]?._errors.length > 0
  ) {
    errorsArray = actionData?.errors[props.name]?._errors;
  }
  const formatter = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  });
  return {
    error: formatter.format(errorsArray),
    withAsterisk: props.required ?? false,
    required: props.required ?? false,
    name: props.name,
    disabled: navigationState === "submitting",
  };
};

// The pin input field is a special case where the error prop is always set to true if there is an error.
export const formInputPropsPinInput = (
  ...args: Parameters<typeof formInputProps>
) => {
  const baseProps = formInputProps(...args);
  return {
    ...baseProps,
    error: baseProps.error !== "",
  };
};

export const errorsObject = (actionData: any) => {
  const errorsObject: { [key: string]: string } = {};
  const formatter = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  });
  if (
    typeof actionData !== "undefined" &&
    typeof actionData === "object" &&
    actionData.hasOwnProperty("errors")
  ) {
    for (const key in actionData.errors) {
      if (
        actionData.errors[key].hasOwnProperty("_errors") &&
        Array.isArray(actionData.errors[key]._errors) &&
        actionData.errors[key]._errors.length > 0
      ) {
        errorsObject[key] = formatter.format(actionData.errors[key]._errors);
      }
    }
  }
  return errorsObject;
};
