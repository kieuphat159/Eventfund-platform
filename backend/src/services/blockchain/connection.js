import { ethers } from "ethers";
import dotenv from "dotenv";
import { createRequire } from "module";

dotenv.config();

const require = createRequire(import.meta.url);
const TicketArtifact = require("./abis/Ticket.json");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

const TicketABI = TicketArtifact.abi ?? TicketArtifact;

const ticket = new ethers.Contract(
  process.env.TICKET_ADDRESS,
  TicketABI,
  provider
);

export { provider, ticket };
