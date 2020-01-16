#!/usr/bin/env node

const Client = require("ali-oss");
const path = require("path");
const slash = require("slash");
const program = require("commander");
const Octokit = require("@octokit/rest");
const request = require("request");

async function upload(fullRepo, toDir) {
  try {
    const region = process.env.REGION;
    const accessKeyId = process.env.ACCESS_KEY_ID;
    const accessKeySecret = process.env.ACCESS_KEY_SECRET;
    const bucket = process.env.BUCKET;

    const token = process.env.GITHUB_TOKEN;
    // ali-oss options

    const aclType = "public-read";
    // upload options
    // const pattern = '*.*';
    const overwrite = true;
    // const fromDir = 'dist';
    // const toDir = 'gxwork';

    const client = new Client({
      region,
      accessKeyId,
      accessKeySecret,
      bucket,
      timeout: 3600000
    });

    const octokit = Octokit({
      auth: token
    });

    // let fullRepo = "lomocc/gxwork:v0.5.1-alpha.1";
    const owner = fullRepo.substring(0, fullRepo.indexOf("/"));
    const repo = fullRepo.substring(
      fullRepo.indexOf("/") + 1,
      fullRepo.indexOf(":")
    );
    const tag = fullRepo.substring(fullRepo.indexOf(":") + 1);

    try {
      const release = await octokit.repos.getReleaseByTag({
        owner,
        repo,
        tag
      });

      console.log("====================================");
      console.log("release", release.data.assets);
      console.log("====================================");

      const assets = release.data.assets;
      console.info("====================================");
      console.info("[Files]");
      console.info(assets.join("\n"));
      console.info("====================================");
      for (const asset of assets) {
        const objectName = slash(path.join(toDir, asset.name));
        console.info(`[${objectName}]`);
        console.info("====================================");
        let shouldUpload = true;
        if (!overwrite) {
          try {
            const result = await client.get(objectName);
            if (result.res.status !== 200) {
              shouldUpload = false;
            }
          } catch (error) {
            console.info(`NoSuchKey: ${objectName}`);
          }
        }
        if (shouldUpload) {
          let httpStream = request(asset.browser_download_url);
          // let writeStream = fs.createWriteStream('/dev/null');
          // let readStream = fs.createReadStream('/dev/null');
          // // 联接Readable和Writable
          // httpStream.pipe(writeStream);

          try {
            //object-name可以自定义为文件名（例如file.txt）或目录（例如abc/test/file.txt）的形式，实现将文件上传至当前Bucket或Bucket下的指定目录。
            // const filePath = path.join(fromDir, asset.name);
            console.info(`[${objectName}] Upload: ${asset.name} ${aclType}`);
            await client.putStream(objectName, httpStream);
            // await client.multipartUpload(objectName, filePath, {
            //   progress: percentage => {
            //     console.info(`[${objectName}] Progress: ${percentage}`);
            //   }
            // });

            if (aclType != null) {
              // 管理文件访问权限
              await client.putACL(objectName, aclType);
            }
            console.info(`[${objectName}] Complete`);
            console.info("====================================");
          } catch (e) {
            //
            console.info(`Error: ${e}`);
          }
        }
      }
    } catch (error) {}
  } catch (error) {
    console.log("====================================");
    console.log("Error: ", error);
    console.log("====================================");
  }
}

program.version("0.0.1");

program.option("-r, --repo", "repo").option("-t, --to", "to dir");

program.parse(process.argv);

upload(program.repo, program.to);
