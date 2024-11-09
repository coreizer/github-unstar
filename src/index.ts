import { Octokit, RequestError } from "octokit"
import { createPrompt, useState, makeTheme, isEnterKey, useKeypress, usePrefix } from "@inquirer/core"

import type { Theme, Status } from "@inquirer/core"
import type { PartialDeep } from "@inquirer/type"

type GitHubTokenConfig = {
  token: string
  validate?: (value: string) => boolean | string | Promise<string | boolean>
  theme?: PartialDeep<Theme>
}

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

const input = createPrompt<string, GitHubTokenConfig>((config, done) => {
  const { validate = () => true } = config
  const theme = makeTheme(config.theme)
  const [status, setStatus] = useState<Status>("idle")
  const [errorMsg, setError] = useState<string>()
  const [value, setValue] = useState<string>("")

  const prefix = usePrefix({ status, theme })

  useKeypress(async (key, rl) => {
    if (status !== "idle") return

    if (isEnterKey(key)) {
      const answer = value
      setStatus("loading")
      const isValid = await validate(answer)
      if (isValid === true) {
        setValue(answer)
        setStatus("done")
        done(answer)
      } else {
        rl.write(value)
        setError(isValid || "Invalid")
        setStatus("idle")
      }
    } else {
      setValue(rl.line)
      setError(undefined)
    }
  })

  let formattedValue = "*".repeat(value.length)
  if (status === "done") {
    formattedValue = theme.style.answer(formattedValue)
  }

  let error = ""
  if (errorMsg) {
    error = theme.style.error(errorMsg)
  }

  return [[prefix, theme.style.message(config.token, status), formattedValue].join(" "), error]
})

const unstar = async (octokit: Octokit, repo: any) => {
  try {
    console.log(`Star: ${repo.owner.login}/${repo.name}`)
    const res = await octokit.request("DELETE /user/starred/{owner}/{repo}", {
      owner: repo.owner.login,
      repo: repo.name,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    })
    if (res.status == 204) {
      console.info("Unstarred")
    }
    return true
  } catch (err: RequestError | any) {
    if (err instanceof RequestError) {
      console.error(err.message)
    } else {
      console.error(err)
    }
    return false
  }
}

input({
  token: "Personal access tokens (classic): ",
})
  .then(async (token: string) => {
    // Octokit.js
    // https://github.com/octokit/core.js#readme
    const octokit = new Octokit({
      auth: token,
    })

    let isRunning = true
    while (isRunning) {
      const { data: repos } = await octokit.request("GET /user/starred")
      if (Array.isArray(repos) && repos.length !== 0) {
        repos.forEach(async (repo) => {
          isRunning = await unstar(octokit, repo)
        })
        await wait(1000)
      }
    }
  })
  .catch((err: RequestError) => {
    console.error(`Error: ${err.message}`, err.status)
  })
