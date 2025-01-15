export default function Layout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <div>
      <script src="https://cdn.zama.ai/fhevmjs/0.6.2/fhevmjs.umd.cjs" type="text/javascript"></script>
      <main>
      {children}
      </main>
    </div>
  );
}
