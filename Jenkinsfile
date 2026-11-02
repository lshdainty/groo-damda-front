pipeline {
    agent any
    parameters {
        choice(name: 'DEPLOY_ENV', choices: ['dev', 'prod'], description: '배포 환경')
        gitParameter(
            name: 'GIT_REF',
            type: 'PT_BRANCH_TAG',
            branchFilter: 'origin/(.*)',
            tagFilter: '*',
            defaultValue: 'main',
            sortMode: 'DESCENDING_SMART',
            selectedValue: 'DEFAULT',
            quickFilterEnabled: true,
            description: '배포할 브랜치 또는 태그'
        )
    }
    environment {
        REPO_URL = "https://github.com/lshdainty/groo-damda-front.git"
        IMAGE_NAME = "groo-damda-front"
        SRC_DIR = "${env.POREST_BASE_DIR}/src/desk-front"
        ENV_SRC_DIR = "${env.POREST_BASE_DIR}/frontend"
        APP_NAME = "desk"
        CONTAINER_NAME = "desk-frontend"
    }
    stages {
        stage('Validate') {
            steps {
                script {
                    // 운영은 릴리즈 태그(vX.Y.Z)만 배포할 수 있다. main 등 브랜치는 거부.
                    if (params.DEPLOY_ENV == 'prod' && !(params.GIT_REF ==~ /v\d+\.\d+\.\d+/)) {
                        error "운영 배포는 릴리즈 태그(vX.Y.Z)만 허용됩니다. 선택된 값: ${params.GIT_REF}"
                    }
                }
            }
        }
        stage('Checkout') {
            steps {
                dir("${SRC_DIR}") {
                    checkout([$class: 'GitSCM',
                        branches: [[name: params.GIT_REF.startsWith('v') ? "refs/tags/${params.GIT_REF}" : "*/${params.GIT_REF}"]],
                        userRemoteConfigs: [[url: "${REPO_URL}", credentialsId: 'github-credentials']]
                    ])
                }
            }
        }
        stage('Resolve Version') {
            steps {
                dir("${SRC_DIR}") {
                    script {
                        if (params.DEPLOY_ENV == 'prod') {
                            // Validate 에서 vX.Y.Z 임이 보장됨 — 선택한 태그가 곧 버전
                            env.APP_VERSION = params.GIT_REF
                        } else {
                            // dev 는 태그 위여도 --long 으로 -0-g<hash> 를 붙여
                            // 운영 이미지(vX.Y.Z)와 이름이 절대 겹치지 않게 한다
                            env.APP_VERSION = sh(
                                script: 'git describe --tags --match \'v*\' --always --long 2>/dev/null || echo unknown',
                                returnStdout: true
                            ).trim()
                        }
                        echo "APP_VERSION = ${env.APP_VERSION}"
                    }
                }
            }
        }
        stage('Prepare Env') {
            steps {
                dir("${SRC_DIR}") {
                    sh "cp ${ENV_SRC_DIR}/${params.DEPLOY_ENV}/${APP_NAME}/${params.DEPLOY_ENV}.env .env.production"
                    // 빌드 시점에 번들로 들어가는 버전 (화면 표시는 프론트에서 import.meta.env.VITE_APP_VERSION 사용)
                    // printf 앞 개행: 원본 env 가 개행 없이 끝나도 마지막 변수 값에 이어붙지 않게
                    sh "printf '\\nVITE_APP_VERSION=%s\\n' '${env.APP_VERSION}' >> .env.production"
                }
            }
        }
        stage('Docker Build') {
            steps {
                dir("${SRC_DIR}") {
                    sh "docker build -t ${IMAGE_NAME}:latest -t ${IMAGE_NAME}:${env.APP_VERSION} ."
                }
            }
        }
        stage('Deploy to Dev') {
            when { expression { params.DEPLOY_ENV == 'dev' } }
            steps {
                echo "Deploying Desk Frontend to Development..."
                sh """
                    docker stop ${CONTAINER_NAME}-dev || true
                    docker rm ${CONTAINER_NAME}-dev || true
                    docker run -d --name ${CONTAINER_NAME}-dev \
                        --hostname ${CONTAINER_NAME}-dev \
                        --restart unless-stopped \
                        --network ${env.DEV_NETWORK} \
                        ${IMAGE_NAME}:${env.APP_VERSION}

                    # 헬스 게이트 — HEALTHCHECK 가 healthy 가 될 때까지 대기, 못 뜨면 배포 실패
                    st=starting
                    for i in \$(seq 1 30); do
                        st=\$(docker inspect -f '{{.State.Health.Status}}' ${CONTAINER_NAME}-dev 2>/dev/null || echo none)
                        [ "\$st" = healthy ] && break
                        [ "\$st" = unhealthy ] && break
                        sleep 2
                    done
                    if [ "\$st" != healthy ]; then
                        echo "헬스 게이트 실패: 상태=\$st"
                        docker logs --tail 40 ${CONTAINER_NAME}-dev || true
                        exit 1
                    fi
                """
            }
        }
        stage('Approval for Prod') {
            when { expression { params.DEPLOY_ENV == 'prod' } }
            steps {
                script {
                    input(
                        id: 'DeployToProd',
                        message: "운영 서버에 배포하시겠습니까?",
                        ok: '배포'
                    )
                }
            }
        }
        stage('Deploy to Prod') {
            when { expression { params.DEPLOY_ENV == 'prod' } }
            steps {
                echo "Deploying Desk Frontend to Production..."
                sh """
                    docker stop ${CONTAINER_NAME}-prod || true
                    docker rm ${CONTAINER_NAME}-prod || true
                    docker run -d --name ${CONTAINER_NAME}-prod \
                        --hostname ${CONTAINER_NAME}-prod \
                        --restart unless-stopped \
                        --network ${env.PROD_NETWORK} \
                        ${IMAGE_NAME}:${env.APP_VERSION}

                    # 헬스 게이트 — HEALTHCHECK 가 healthy 가 될 때까지 대기, 못 뜨면 배포 실패
                    st=starting
                    for i in \$(seq 1 30); do
                        st=\$(docker inspect -f '{{.State.Health.Status}}' ${CONTAINER_NAME}-prod 2>/dev/null || echo none)
                        [ "\$st" = healthy ] && break
                        [ "\$st" = unhealthy ] && break
                        sleep 2
                    done
                    if [ "\$st" != healthy ]; then
                        echo "헬스 게이트 실패: 상태=\$st"
                        docker logs --tail 40 ${CONTAINER_NAME}-prod || true
                        exit 1
                    fi
                """
            }
        }
    }
}
