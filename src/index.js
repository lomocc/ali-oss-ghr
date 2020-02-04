#!/usr/bin/env node

const Client = require("ali-oss");
const path = require("path");
const slash = require("slash");
const program = require("commander");
const Octokit = require("@octokit/rest");
const request = require("request");
const os = require("os");
require("dotenv").config();

async function upload(fullRepo) {
  try {
    const region = process.env.REGION;
    const accessKeyId = process.env.ACCESS_KEY_ID;
    const accessKeySecret = process.env.ACCESS_KEY_SECRET;
    const bucket = process.env.BUCKET;
    const aclType = process.env.ACL_TYPE || "public-read"; // 阿里云访问权限
    const directory = process.env.DIRECTORY || ""; // 阿里云目录
    const overwrite = process.env.OVERWRITE !== "false"; // 覆盖已存在的文件
    // const pattern = '*.*';
    const token = process.env.GITHUB_TOKEN; // github token

    console.log("====================================");
    console.log({ region, bucket, directory, overwrite });
    console.log("====================================");

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

    const sTagIndex = fullRepo.indexOf(":");
    const sHasTag = sTagIndex !== -1;
    const owner = fullRepo.substring(0, fullRepo.indexOf("/"));
    const repo = fullRepo.substring(
      fullRepo.indexOf("/") + 1,
      sHasTag ? sTagIndex : undefined
    );

    try {
      let release;
      if (sHasTag) {
        const tag = fullRepo.substring(sTagIndex + 1);
        release = await octokit.repos.getReleaseByTag({
          owner,
          repo,
          tag
        });
      } else {
        release = await octokit.repos.getLatestRelease({
          owner,
          repo
        });
      }
      const { tag_name, assets } = release.data;
      console.log("====================================");
      console.log("正在同步", tag_name);
      console.log(
        assets
          .map(asset => `[${asset.name}](${asset.browser_download_url})`)
          .join(os.EOL)
      );
      console.log("====================================");
      for (const asset of assets) {
        const objectName = slash(path.join(directory, asset.name));
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
          } catch (error) {
            console.log("====================================");
            console.log("Error: ", error.message);
            console.log("====================================");
          }
        }
      }
    } catch (error) {
      console.log("====================================");
      console.log("Error: ", error.message);
      console.log("====================================");
    }
  } catch (error) {
    console.log("====================================");
    console.log("Error: ", error.message);
    console.log("====================================");
  }
}

program.version("0.0.1");

program.arguments("<repo>").action(function(repo) {
  program.repo = repo;
});

program.parse(process.argv);

upload(program.repo);
