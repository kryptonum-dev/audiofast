export default function BlogListingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="page-transition">
      {children}
    </main>
  );
}
