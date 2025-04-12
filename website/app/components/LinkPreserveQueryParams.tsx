import { Link, useLocation } from "react-router";

export const LinkPreserveQueryParams: React.FC<
  {
    to: string;
    children?: React.ReactNode;
  } & React.HTMLAttributes<HTMLAnchorElement>
> = ({ to, children, ...props }) => {
  const location = useLocation();
  return (
    <Link
      to={{
        pathname: to,
        search: location.search,
      }}
      {...props}
    >
      {children}
    </Link>
  );
};
