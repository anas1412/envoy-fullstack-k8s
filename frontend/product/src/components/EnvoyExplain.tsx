const BLOCKS = [
  {
    q: 'Why do we need Envoy?',
    a: 'In Kubernetes, the pods behind a service are disposable - they restart, scale up and down, and get new IPs constantly. Default cluster networking only balances at the network level (IP + port) with no idea what is inside a request. Envoy is the layer that understands L7: it reads the hostname and path, checks auth, and routes each request to the right pod - something plain cluster networking cannot do.',
  },
  {
    q: 'What does it replace?',
    a: 'In a Kubernetes world, Envoy replaces kube-proxy\u2019s blind round-robin whenever you need more than "any pod will do". It replaces the usual Ingress controller (nginx-ingress, Traefik) when you need path and header routing, per-route auth, rate limits, or real traffic metrics - Envoy is the engine those controllers wrap. In a service mesh it replaces per-app code for retries, timeouts, circuit breaking, mTLS, and observability by running as a sidecar next to every pod. And it replaces hand-rolled service discovery: instead of apps guessing each other\u2019s addresses, Envoy watches the Kubernetes API for the live list of pod IPs.',
  },
  {
    q: 'What happens without it?',
    a: 'Traffic is routed at L4 only - "send to this IP and port" - so there is no path-based routing, no hostname rules, and no auth at the gateway. Every service that must be reachable has to be exposed directly (its own NodePort or LoadBalancer), which grows the attack surface. There is no central choke point, so auth, rate limits, and observability have to live inside each app, written differently everywhere. And inter-service calls become blind round-robin: a dead pod keeps receiving traffic until Kubernetes notices, with no shared retry or circuit-breaker layer.',
  },
  {
    q: 'How does it work in Kubernetes?',
    a: 'Envoy runs as a pod - either as the edge gateway, the single entry point for outside traffic, or as a sidecar next to every service in a mesh. It connects to the Kubernetes API, which tells it which pods exist and what their current IPs are - a moving target. When a request arrives, it matches the hostname and path against a route table, runs its filter chain (auth, limits, logging), picks a healthy pod, and forwards. Because the pod list is always current, Envoy keeps routing correctly as pods restart, die, and scale.',
  },
]

const FLOW = [
  ['outside traffic ─▶ Envoy edge pod'],
  ['                       │  L7: match host + path'],
  ['                       │  filters: auth · rate limits · logging'],
  ['                       │  watches the K8s API for live pod IPs'],
  ['                       ▼'],
  ['                ┌───▶ product pods'],
  ['                ├───▶ backend pods ──▶ Envoy L4 ──▶ postgres'],
  ['                └───▶ grafana / prometheus (monitoring)'],
]

export function EnvoyExplain() {
  return (
    <section className="mt-10 rounded-lg border border-line bg-panel p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-faint">envoy, explained</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-fg">
        The traffic brain in a Kubernetes cluster
      </h2>

      <div className="mt-5 space-y-5">
        {BLOCKS.map((b) => (
          <div key={b.q}>
            <h3 className="text-sm font-semibold text-copper">{b.q}</h3>
            <p className="mt-1 text-sm leading-relaxed text-dim">{b.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-line/60 pt-4">
        <p className="text-xs font-semibold text-fg">The shape of it in K8s</p>
        <pre className="mt-2 overflow-x-auto font-mono text-xs leading-relaxed text-faint">
          {FLOW.map((l) => l[0]).join('\n')}
        </pre>
      </div>
    </section>
  )
}
