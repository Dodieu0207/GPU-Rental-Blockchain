import type { GPU } from "@/lib/types";

const baseProvider = "Dataset provider";
const defaultPriceByGpu: Record<string, string> = {
  "Nvidia A100": "0.045",
  "Nvidia RTX 4090": "0.018",
  "Nvidia RTX 3090": "0.012",
  "Nvidia RTX 4060 Ti": "0.006",
  "Nvidia RTX 3060": "0.004",
};

const rows = [
  ["1", "Nvidia A100", "80GB HBM2e", "AMD EPYC 7763", "2TB NVMe", "12.2", "10 Gbps", "Ubuntu 22.04 LTS", "Hanoi, Vietnam", "bafkreiebfueatszek3byrr5rz5qbj7navavxbbodbs7falfeir4wzh65hi"],
  ["2", "Nvidia A100", "80GB HBM2e", "Intel Xeon Platinum 8380", "4TB NVMe", "12.4", "10 Gbps", "Ubuntu 22.04 LTS", "Ho Chi Minh City, Vietnam", "bafkreibxsmsu5fbw3kw4azqjb7va7dn2y2d7hxmcysf3ul7sxrwdlhtx3i"],
  ["3", "Nvidia A100", "40GB HBM2", "AMD EPYC 7543", "2TB NVMe", "12.0", "5 Gbps", "Ubuntu 20.04 LTS", "Da Nang, Vietnam", "bafkreihl4xo62swktcbzlhzq53f5ff2ssqqxq46vygqzryf2llnkcmgt4q"],
  ["4", "Nvidia A100", "80GB HBM2e", "Intel Xeon Gold 6330", "2TB NVMe", "12.2", "10 Gbps", "Ubuntu 22.04 LTS", "Hanoi, Vietnam", "bafkreigh2fy3hi7kao4cfhpjoxbdlfztxeuqrh73rtd57anygkw3xqbs6m"],
  ["5", "Nvidia A100", "40GB HBM2", "AMD EPYC 7313", "1TB NVMe", "12.1", "2 Gbps", "CentOS Stream 9", "Binh Duong, Vietnam", "bafkreig6thpod3jhz5qa62ndq4psboyq75ax3lxe3eemikkjlovspgl76i"],
  ["6", "Nvidia RTX 4090", "24GB GDDR6X", "Intel Core i9-14900K", "1TB NVMe Gen4", "12.1", "1 Gbps", "Windows 11 Pro", "Ho Chi Minh City, Vietnam", "bafkreieahj72n3zh5ftqjcwx67rfchcejqymw3okj7o4rv7ydgf6oaet3i"],
  ["7", "Nvidia RTX 4090", "24GB GDDR6X", "AMD Ryzen 9 7950X", "2TB NVMe", "12.3", "1 Gbps", "Ubuntu 22.04 LTS", "Hanoi, Vietnam", "bafkreigqi7vqudk4k2tsevij55dpj53u3ah7vncvn66k5gosk2utu5oeiq"],
  ["8", "Nvidia RTX 4090", "24GB GDDR6X", "Intel Core i7-14700K", "1TB NVMe", "12.1", "500 Mbps", "Windows 11 Pro", "Da Nang, Vietnam", "bafkreihlksh7fta6wwk5bvwlxezlt6spozjcaqsg5dfzoeizmw7ctryr5u"],
  ["9", "Nvidia RTX 4090", "24GB GDDR6X", "AMD Ryzen 9 5950X", "2TB NVMe", "12.2", "1 Gbps", "Ubuntu 22.04 LTS", "Ho Chi Minh City, Vietnam", "bafkreidpf73oqmvcmkwxapfrx3d7g7tdz3w7yo5kfcrjfqi5froax473ie"],
  ["10", "Nvidia RTX 4090", "24GB GDDR6X", "Intel Core i9-13900K", "1TB NVMe", "12.1", "300 Mbps", "Windows 10 Pro", "Can Tho, Vietnam", "bafkreibnsm7ovznl4kpdakarif5lwpxyyqzossamf257i4wdw2effmpqou"],
] as const;

export const datasetGPUs: GPU[] = rows.map(([id, gpu, vram, cpu, ssd, cuda, network, os, location, cid]) => ({
  id: `dataset-${id}`,
  machineId: `Machine ${id}`,
  name: `${gpu} - ${vram}`,
  gpu,
  vram,
  cpu,
  ssd,
  cuda,
  network,
  os,
  location,
  cid,
  provider: baseProvider,
  priceEth: defaultPriceByGpu[gpu] ?? "0.01",
  status: "unavailable",
  source: "dataset",
}));
