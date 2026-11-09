import { ButtonLink, Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="text-center">
        <Logo />
        <h1 className="display mt-10 text-[64px] text-ink-950">Not found.</h1>
        <p className="mt-3 text-[15px] text-ink-600">Even the AI engines couldn't find this page.</p>
        <ButtonLink href="/" className="mt-8">Back home</ButtonLink>
      </div>
    </div>
  );
}
