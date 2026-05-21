import { useState } from "react";
import {
  Button,
  Text,
  Title,
  Container,
  Input,
  Checkbox,
} from "@bsf/force-ui";
import { ChevronRight, ChevronLeft } from "lucide-react";
import wpApiFetch from "@wordpress/api-fetch";
import { toast } from "@bsf/force-ui";

const { __ } = wp.i18n;

const UserInfo = ({ goToNextStep, goToPreviousStep, userInfoData = {}, setUserInfoData }) => {
  const formData = userInfoData;
  const [isSaving, setIsSaving] = useState(false);

  const updateField = (field, value) => {
    setUserInfoData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSaving(true);

    try {
      await wpApiFetch({
        path: "/presto-player/v1/onboarding/save-user-info",
        method: "POST",
        data: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          optIn: formData.optIn,
        },
      });
    } catch (error) {
      toast.error(__("Error!", "presto-player"), {
        description: __("Failed to save your information. Please try again.", "presto-player"),
      });
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    goToNextStep();
  };

  const handleSkip = () => {
    goToNextStep();
  };

  return (
    <div>
      <Container direction="column" gap="lg" className="gap-6">
        {/* Header */}
        <Container direction="column" gap="xs">
          <Title
            size="lg"
            tag="h2"
            title={__("Get the best start", "presto-player")}
          />
          <Text size={14} weight={400} color="secondary">
            {__(
              "Get helpful updates, new features, and tips to make your website better, while helping us improve Presto Player.",
              "presto-player"
            )}
          </Text>
        </Container>

        {/* Form Fields */}
        <div className="grid grid-cols-2 gap-6">
          {/* First Name */}
          <div>
            <Input
              size="md"
              label={__("First Name", "presto-player")}
              placeholder={__("First Name", "presto-player")}
              value={formData.firstName}
              onChange={(value) => updateField("firstName", value)}
            />
          </div>

          {/* Last Name */}
          <div>
            <Input
              size="md"
              label={__("Last Name", "presto-player")}
              placeholder={__("Last Name", "presto-player")}
              value={formData.lastName}
              onChange={(value) => updateField("lastName", value)}
            />
          </div>

          {/* Email - full width */}
          <div className="col-span-2">
            <Input
              size="md"
              type="email"
              label={__("Email", "presto-player")}
              placeholder={__("Email", "presto-player")}
              value={formData.email}
              onChange={(value) => updateField("email", value)}
            />
          </div>

          {/* Opt-In Checkbox */}
          <div className="col-span-2 flex items-start gap-2 [&>div]:mt-[1px]">
            <Checkbox
              size="sm"
              id="optIn"
              checked={formData.optIn}
              onChange={(checked) => updateField("optIn", checked)}
            />
            <label htmlFor="optIn" className="cursor-pointer">
              <Text size={14} weight={400} color="secondary">
                {__(
                  "Get notified about updates, tips and new features. Plus help us improve by sharing how you use the plugin.",
                  "presto-player"
                )}{" "}
                <a
                  href="https://prestoplayer.com/share-usage-data/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-secondary underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {__("Learn more", "presto-player")}
                </a>
              </Text>
            </label>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-t border-solid border-border-subtle border-b-0 m-0 w-full" />

        {/* Footer Buttons */}
        <Container
          direction="row"
          align="center"
          className="justify-between"
        >
          <Button
            icon={<ChevronLeft />}
            variant="outline"
            onClick={goToPreviousStep}
          >
            {__("Back", "presto-player")}
          </Button>
          <Container direction="row" align="center" gap="sm">
            <Button
              className="text-text-tertiary"
              variant="ghost"
              onClick={handleSkip}
            >
              {__("Skip", "presto-player")}
            </Button>
            <Button
              iconPosition="right"
              icon={<ChevronRight />}
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving
                ? __("Saving...", "presto-player")
                : __("Continue", "presto-player")}
            </Button>
          </Container>
        </Container>
      </Container>
    </div>
  );
};

export default UserInfo;
