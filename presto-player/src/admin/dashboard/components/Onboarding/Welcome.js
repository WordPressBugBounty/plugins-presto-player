import { useState, useEffect } from "react";
import { Button, Text, Title, Container } from "@bsf/force-ui";
import { ChevronRight, Check, Play, X } from "lucide-react";

const { __ } = wp.i18n;

const VIDEO_ID = "7ibtk_KTgCw";
const THUMBNAIL_URL = `https://img.youtube.com/vi/${VIDEO_ID}/maxresdefault.jpg`;

const HIGHLIGHTS = [
  __("Embed YouTube, Vimeo, Bunny.net, self-hosted videos, and audio", "presto-player"),
  __("Customize controls, branding, and chapter markers", "presto-player"),
  __("Capture leads with opt-in gates and in-video CTAs", "presto-player"),
  __("Works with Gutenberg, Elementor, Divi, and major LMS plugins", "presto-player"),
];

const Welcome = ({ goToNextStep }) => {
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  useEffect(() => {
    if (!isVideoOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsVideoOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVideoOpen]);

  return (
    <>
      <Container direction="column" gap="lg" className="gap-6">
        <Container direction="column" gap="xs">
          <Title
            size="lg"
            tag="h2"
            title={__("Welcome to Presto Player", "presto-player")}
            className="text-[30px] leading-[38px]"
          />
          <Text size={16} weight={500}>
            {__("The Professional Video Player for WordPress.", "presto-player")}
          </Text>
        </Container>

        <div
          className="cursor-pointer group"
          onClick={() => setIsVideoOpen(true)}
          role="button"
          aria-label={__("Play introduction video", "presto-player")}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsVideoOpen(true);
            }
          }}
        >
          <div className="relative w-full overflow-hidden rounded-xl">
            <img
              src={THUMBNAIL_URL}
              alt={__("Presto Player Introduction", "presto-player")}
              className="w-full h-auto object-cover block"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center bg-white bg-opacity-90 rounded-full shadow-lg group-hover:scale-110 transition-transform duration-200">
              <Play className="size-7 text-brand-primary-600 ml-1 fill-current" />
            </div>
          </div>
        </div>

        <Container direction="column" gap="xs">
          {HIGHLIGHTS.map((text, index) => (
            <Container key={index} direction="row" align="center" gap="xs">
              <Check className="size-4 text-icon-interactive flex-shrink-0" />
              <Text size={14} weight={600} color="secondary">
                {text}
              </Text>
            </Container>
          ))}
        </Container>

        <hr className="border-t border-solid border-border-subtle border-b-0 m-0 w-full" />

        <Container direction="row" justify="start" align="center">
          <Button
            className="px-4 w-max"
            iconPosition="right"
            icon={<ChevronRight />}
            onClick={goToNextStep}
          >
            {__("Let's Get Started", "presto-player")}
          </Button>
        </Container>
      </Container>

      { isVideoOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 cursor-pointer w-screen z-[999999]"
          onClick={ () => setIsVideoOpen( false ) }
        >
          <div className="text-white absolute top-4 right-4 flex items-center gap-2">
            <span className="text-sm font-medium">{ __( 'Esc', 'presto-player' ) }</span>
            <X size={ 20 } className="cursor-pointer" onClick={ () => setIsVideoOpen( false ) } />
          </div>
          <div
            className="relative rounded-lg shadow-lg w-4/5 cursor-default"
            onClick={ ( e ) => e.stopPropagation() }
          >
            <iframe
              className="w-full lg:h-188 sm:h-120 h-60 rounded-lg border-0"
              src={ `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1` }
              title={ __( 'Presto Player Introduction', 'presto-player' ) }
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        </div>
      ) }
    </>
  );
};

export default Welcome;
