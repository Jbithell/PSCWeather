import {
  ActionIcon,
  Alert,
  CloseButton,
  Group,
  Text,
  type ColorInputProps,
  type NumberInputProps,
  type SelectProps,
  type TextareaProps,
  type TextInputProps,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { IconDeviceFloppy, IconPencil } from "@tabler/icons-react";
import { cloneElement, useEffect, type ReactElement } from "react";
import { Form, useBlocker } from "react-router";
import type { ZodObject, ZodRawShape } from "zod";
import { errorsObject } from "~/utils/forms/formProps";
import { BlockerMessage } from "../Forms/BlockerMessage";

interface FormFieldProps {
  formData: {
    schema: ZodObject<ZodRawShape>;
    actionData: any;
    id: number;
    formId?: string;
    fieldBeingEditedState: [string | null, (arg0: string | null) => void]; // Track which field is being edited
  };
  ThisInput: ReactElement<
    | TextInputProps
    | SelectProps
    | NumberInputProps
    | ColorInputProps
    | TextareaProps
  >;
  fieldKey: string;
  value: string;
}
const FormField = ({
  formData,
  ThisInput,
  fieldKey,
  value,
  closeHandler,
}: {
  closeHandler: () => void;
} & FormFieldProps) => {
  const form = useForm({
    mode: "uncontrolled",
    onSubmitPreventDefault: "validation-failed",
    validateInputOnChange: true,
    validateInputOnBlur: true,
    clearInputErrorOnChange: true,
    initialValues: {
      [fieldKey]: value,
    },
    validate: zodResolver(formData.schema.pick({ [fieldKey]: true })),
  });
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      form.isDirty() && currentLocation.pathname !== nextLocation.pathname
  );
  useEffect(() => {
    if (
      formData.actionData?.data &&
      formData.actionData.data.id === formData.id &&
      formData.actionData.data.hasOwnProperty(fieldKey)
    ) {
      if (form.isDirty()) closeHandler();
      form.setValues(formData.actionData.data);
      form.resetDirty();
    }
    if (
      formData.actionData?.errors &&
      formData.actionData?.data.id === formData.id
    )
      form.setErrors(errorsObject(formData.actionData));
  }, [formData.actionData]);
  return (
    <Form method="post">
      {formData.actionData?.error && (
        <Alert variant="light" title="Changes not saved">
          {formData.actionData.error}
        </Alert>
      )}
      <BlockerMessage blocker={blocker} />
      <Group grow preventGrowOverflow={false} wrap="nowrap">
        {cloneElement(ThisInput, {
          key: form.key(fieldKey),
          ...form.getInputProps(fieldKey),
          size: "sm",
          autoFocus: true,
          name: fieldKey,
          style: { minWidth: "10em" },
          disabled: form.submitting,
          onKeyDown: (event: React.KeyboardEvent) =>
            event.key === "Escape" && closeHandler(),
          leftSection: (
            <CloseButton
              onClick={() => closeHandler()}
              aria-label="Close"
              size="xs"
              style={{ marginLeft: "0.5em" }}
            />
          ),
        })}
        <ActionIcon
          type="submit"
          variant="outline"
          size="input-sm"
          disabled={!form.isDirty() || form.submitting}
          loading={form.submitting}
        >
          <IconDeviceFloppy />
        </ActionIcon>
      </Group>
      <input type="hidden" name="id" value={formData.id} />
      {formData.formId && ( // Used for pages with multiple forms on the same page
        <input type="hidden" name="form-id" value={formData.formId} />
      )}
    </Form>
  );
};

export const TableField = <CanEditType extends boolean>({
  canEdit,
  formData,
  ThisInput,
  fieldKey,
  value,
  displayValue,
}: {
  canEdit: CanEditType;
  displayValue?: React.ReactNode;
} & (CanEditType extends true ? FormFieldProps : Partial<FormFieldProps>)) => {
  // Keep track of which field is being edited, so we can close it if another field is opened
  const [opened, handlers] = useDisclosure(false);
  const [fieldBeingEdited, setFieldBeingEdited] =
    formData?.fieldBeingEditedState || [];
  useEffect(() => {
    if (
      fieldBeingEdited &&
      fieldBeingEdited !== `${formData?.formId}-${fieldKey}-${formData?.id}` &&
      opened
    )
      handlers.close();
  }, [fieldBeingEdited, opened]);
  const closeHandler = () => {
    if (
      fieldBeingEdited === `${formData?.formId}-${fieldKey}-${formData?.id}` &&
      setFieldBeingEdited
    )
      setFieldBeingEdited(null);
    handlers.close();
  };
  const openHandler = () => {
    if (setFieldBeingEdited)
      setFieldBeingEdited(`${formData?.formId}-${fieldKey}-${formData?.id}`);
    handlers.open();
  };

  return (
    <>
      {opened && canEdit && (
        <FormField
          formData={formData!}
          ThisInput={ThisInput!}
          fieldKey={fieldKey!}
          value={value!}
          closeHandler={() => closeHandler()}
        />
      )}
      <Group
        justify="space-between"
        preventGrowOverflow={false}
        wrap="nowrap"
        style={{ maxWidth: "20em" }}
      >
        {!opened && (
          <Text
            style={{
              cursor: canEdit ? "pointer" : "default",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            {...(value ? { title: value } : {})}
            {...(canEdit && { tabIndex: 0 })}
            onKeyDown={({ key }) => key === "Enter" && canEdit && openHandler()}
            onClick={canEdit ? openHandler : undefined}
          >
            {displayValue ? displayValue : value}
          </Text>
        )}
        {canEdit && !opened && (
          <ActionIcon
            onClick={openHandler}
            variant="subtle"
            {...handlers}
            tabIndex={-1}
            size={"sm"}
            color="gray"
            aria-label="Edit"
          >
            <IconPencil />
          </ActionIcon>
        )}
      </Group>
    </>
  );
};
