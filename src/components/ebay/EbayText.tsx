// One tagged eBay link as a line of text, with its "Paid link" note beside
// it (the EPN quality team checks for a disclosure at the link, not only in
// the footer). Through OutboundLink: rel="sponsored nofollow", target _blank.
// Server or client: no state.
import OutboundLink from "../OutboundLink";

export type EbayTextLinkData = { href: string; paid: boolean; retailer: string };

export const PaidTag = ({ paid, className = "" }: { paid: boolean; className?: string }) =>
  paid ? <span className={`whitespace-nowrap text-[10px] font-normal text-subtle ${className}`}>Paid link</span> : null;

export default function EbayText({
  link,
  product,
  placement,
  children,
  className = "",
}: {
  link: EbayTextLinkData;
  product: string;
  placement: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 ${className}`}>
      <OutboundLink href={link.href} retailer={link.retailer} product={product} placement={placement} className="font-semibold">
        {children}
        <span aria-hidden> ↗</span>
      </OutboundLink>
      <PaidTag paid={link.paid} />
    </span>
  );
}
