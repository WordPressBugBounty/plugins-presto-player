import React from "react";
const { __ } = wp.i18n;
import { Button, Container, Text, Title } from "@bsf/force-ui";
import { Plus, ExternalLink } from "lucide-react";

const VIDEO_ID = "7ibtk_KTgCw";
const THUMBNAIL_URL = `https://img.youtube.com/vi/${VIDEO_ID}/hqdefault.jpg`;

const WelcomeBanner = ({ onVideoOpen, videoTriggerRef }) => {
  return (
    <Container
      className="p-4 border border-solid border-border-subtle bg-background-primary rounded-xl shadow-soft-shadow overflow-clip"
      direction={{ sm: "column", md: "row" }}
      gap="lg"
      align="center"
    >

      {/* Content */}
      <Container.Item className="md:w-[60%] lg:w-[70%]">
        <Container direction="column" gap="lg" className="px-2 py-2">
          <Container.Item>
            <Title
              size="lg"
              tag="h3"
              title={__("Welcome to Presto Player!", "presto-player")}
            />
            <Text className="text-text-secondary mt-1 font-normal text-sm">
              {__(
                "We're excited to help you create amazing video experience for your WordPress site. Presto Player makes it simple to add powerful, customizable video players that engage your audience.",
                "presto-player"
              )}
            </Text>
          </Container.Item>
          <Container.Item>
            <Container className="gap-3">
              <Button
                icon={<Plus className="w-5 h-5" />}
                iconPosition="left"
                size="md"
                tag="button"
                type="button"
                variant="primary"
                onClick={() => {
                  window.location.href =
                    window.prestoPlayer?.createMediaUrl ||
                    "post-new.php?post_type=pp_video_block";
                }}
              >
                {__("Create Media", "presto-player")}
              </Button>
              <Button
                icon={<ExternalLink className="w-5 h-5" />}
                iconPosition="right"
                size="md"
                tag="button"
                type="button"
                variant="ghost"
                onClick={() => {
                  window.open(
                    "https://www.youtube.com/playlist?list=PLiEQfBIWdTTLiE6ch4DsqlsfRIrJ1emLV",
                    "_blank"
                  );
                }}
              >
                {__("Learn More", "presto-player")}
                <span className="sr-only">
                  {__("(opens in a new tab)", "presto-player")}
                </span>
              </Button>
            </Container>
          </Container.Item>
        </Container>
      </Container.Item>

      {/* Video thumbnail */}
      <Container.Item className="shrink-0 w-full md:w-[360px] p-2">
        <div
          ref={videoTriggerRef}
          className="relative cursor-pointer w-full overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          onClick={() => onVideoOpen(true)}
          role="button"
          aria-label={__("Play introduction video", "presto-player")}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onVideoOpen(true);
            }
          }}
        >
          <img
            src={THUMBNAIL_URL}
            alt=""
            role="presentation"
            className="w-full h-full object-cover rounded-lg aspect-video cursor-pointer"
            loading="lazy"
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
            <svg
              className="w-6 h-6 text-white"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7L8 5z"></path>
            </svg>
          </div>
        </div>
      </Container.Item>
    </Container>
  );
};

export default WelcomeBanner;
