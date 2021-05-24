import 'dotenv/config';
import {TheGraph} from '../utils/thegraph';

const theGraph = new TheGraph(`https://api.thegraph.com/subgraphs/name/${process.env.SUBGRAPH_NAME}`);

// query($blockNumber: Int! $first: Int! $lastId: ID! $id: ID!) {
const queryString = `
query($first: Int! $lastId: ID!) {
    planets(first: $first where: {
      id_gt: $lastId
    }) {
      id
    }
}
`;

async function main() {
  const planets: {
    id: string;
  }[] = await theGraph.query(queryString, {field: 'planets'});
  console.log({planets: planets, numPlanets: planets.length});
}

main();
