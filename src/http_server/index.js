import * as fs from "fs";
import { mkdtemp, readFile } from "node:fs/promises";
import * as path from "path";
import * as http from "http";
import { WebSocketServer } from "ws";
import {
  Button,
  down,
  left,
  mouse,
  screen,
  Point,
  right,
  up,
  Region,
} from "@nut-tree/nut-js";

const wss = new WebSocketServer({ port: 8001 });
const temporaryDirectory = await mkdtemp("remote-control-images-");

function getCircleCoords(radius, centerX, centerY) {
  const steps = 314;
  const xValues = [];
  const yValues = [];
  for (let i = 0; i < steps; i++) {
    xValues[i] = centerX + radius * Math.cos((2 * Math.PI * i) / steps);
    yValues[i] = centerY + radius * Math.sin((2 * Math.PI * i) / steps);
  }

  return { xValues, yValues };
}

const commands = {
  ["mouse_left"]: async ({ args: [pixels] }) =>
    await mouse.move(left(Number.parseInt(pixels))),
  ["mouse_right"]: async ({ args: [pixels] }) =>
    await mouse.move(right(Number.parseInt(pixels))),
  ["mouse_up"]: async ({ args: [pixels] }) =>
    await mouse.move(up(Number.parseInt(pixels))),
  ["mouse_down"]: async ({ args: [pixels] }) =>
    await mouse.move(down(Number.parseInt(pixels))),
  ["mouse_position"]: async ({ ws }) => {
    const { x, y } = await mouse.getPosition();
    console.log(`${x},${y}`);
    ws.send(`mouse_position ${x},${y}`);
  },
  ["draw_circle"]: async ({ args: [radius] }) => {
    const { x, y } = await mouse.getPosition();

    const { xValues, yValues } = getCircleCoords(radius, x, y);

    const points = xValues.map(
      (xValue, index) => new Point(xValue, yValues[index])
    );

    await mouse.pressButton(Button.LEFT);
    await mouse.move(points);
    await mouse.releaseButton(Button.LEFT);
  },
  ["draw_rectangle"]: async ({ args: [heightString, widthString] }) => {
    const height = Number.parseInt(heightString);
    const width = Number.parseInt(widthString);

    const { x, y } = await mouse.getPosition();

    const baseSpeed = mouse.config.mouseSpeed;
    mouse.config.mouseSpeed = 20;

    await mouse.drag([
      new Point(x + width, y),
      new Point(x + width, y - height),
      new Point(x, y - height),
      new Point(x, y),
    ]);

    mouse.config.mouseSpeed = baseSpeed;
  },
  ["draw_square"]: async ({ args: [sideString] }) => {
    const side = Number.parseInt(sideString);

    const { x, y } = await mouse.getPosition();

    const baseSpeed = mouse.config.mouseSpeed;
    mouse.config.mouseSpeed = 20;

    await mouse.drag([
      new Point(x + side, y),
      new Point(x + side, y - side),
      new Point(x, y - side),
      new Point(x, y),
    ]);

    mouse.config.mouseSpeed = baseSpeed;
  },
  ["prnt_scrn"]: async ({ ws }) => {
    const regionSide = 200;

    const { x, y } = await mouse.getPosition();

    const regionStartX = x - regionSide / 2;
    const regionStartY = y - regionSide / 2;

    const region = new Region(
      regionStartX,
      regionStartY,
      regionSide,
      regionSide
    );

    const filePath = await screen.captureRegion("image", region);
    const fileContents = await readFile(filePath);
    const imageInBase64 = Buffer.from(fileContents).toString("base64");

    ws.send(`prnt_scrn ${imageInBase64}`);
  },
};

wss.on("connection", (ws) => {
  ws.on("message", async (data) => {
    console.log("received: %s", data);

    const [command, ...args] = data.toString().trim().split(" ");
    console.log(command, args);

    commands[command]({ ws, args });
  });

  ws.send("something");
});

export const httpServer = http.createServer((req, res) => {
  const __dirname = path.resolve(path.dirname(""));
  const file_path =
    __dirname + (req.url === "/" ? "/front/index.html" : "/front" + req.url);

  fs.readFile(file_path, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end(JSON.stringify(err));
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
});
