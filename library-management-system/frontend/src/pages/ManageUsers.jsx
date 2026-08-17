import { useEffect, useState } from 'react';
import {
    Download,
    Eye,
    Lock,
    Printer,
    QrCode,
    Search,
    Unlock,
    X
} from 'lucide-react';
import QRCode from 'qrcode';
import { api, date } from '../api';
import { useAuth } from '../context/AuthContext';
import AdminShell from '../components/AdminShell';
import { Empty, Modal, Status } from '../components/UI';
import {
    confirmAction,
    showError,
    showSuccess
} from '../utils/feedback';

const ROLE_LABELS = {
    MEMBER: 'Độc giả',
    LIBRARIAN: 'Thủ thư',
    ADMIN: 'Quản trị viên'
};

function roleLabel(role) {
    return ROLE_LABELS[role] || role || 'Chưa xác định';
}

export default function ManageUsers() {
    const [users, setUsers] = useState([]);
    const [query, setQuery] = useState('');
    const [view, setView] = useState(null);
    const [userQr, setUserQr] = useState(null);

    const [roleUpdatingId, setRoleUpdatingId] =
        useState(null);

    const [statusUpdatingId, setStatusUpdatingId] =
        useState(null);

    const { user } = useAuth();

    const isAdmin =
        user?.role === 'ADMIN';


    async function load() {
        try {
            const response =
                await api('/api/users?size=200');

            setUsers(
                response.content || []
            );

        } catch (error) {
            showError(
                error.message
            );
        }
    }


    useEffect(() => {
        load();
    }, []);


    function isCurrentAccount(target) {
        return (
            Number(target?.id) ===
            Number(user?.id)
        );
    }


    async function changeStatus(target) {
        if (!isAdmin) {
            return;
        }


        if (isCurrentAccount(target)) {
            showError(
                'Bạn không thể khóa hoặc thay đổi trạng thái của chính tài khoản đang đăng nhập.'
            );

            return;
        }


        const next =
            target.status === 'ACTIVE'
                ? 'LOCKED'
                : 'ACTIVE';


        const actionLabel =
            next === 'LOCKED'
                ? 'Khóa'
                : 'Mở khóa';


        const confirmed =
            await confirmAction(
                `${actionLabel} tài khoản ${target.fullName || target.email}?`,
                {
                    title:
                        `${actionLabel} tài khoản`,

                    confirmText:
                        next === 'LOCKED'
                            ? 'Khóa tài khoản'
                            : 'Mở khóa'
                }
            );


        if (!confirmed) {
            return;
        }


        setStatusUpdatingId(
            target.id
        );


        try {
            await api(
                `/api/users/${target.id}/status?status=${next}`,
                {
                    method: 'PATCH'
                }
            );


            await load();


            showSuccess(
                next === 'LOCKED'
                    ? 'Đã khóa tài khoản.'
                    : 'Đã mở khóa tài khoản.'
            );

        } catch (error) {
            showError(
                error.message
            );

        } finally {
            setStatusUpdatingId(
                null
            );
        }
    }


    async function changeRole(
        target,
        nextRole
    ) {
        if (
            !isAdmin ||
            !nextRole ||
            nextRole === target.role
        ) {
            return;
        }


        if (isCurrentAccount(target)) {
            showError(
                'Bạn không thể thay đổi vai trò của chính tài khoản đang đăng nhập.'
            );

            return;
        }


        const currentLabel =
            roleLabel(
                target.role
            );


        const nextLabel =
            roleLabel(
                nextRole
            );


        const warning =
            nextRole === 'ADMIN'

                ? ' Tài khoản này sẽ có quyền quản trị hệ thống sau khi đăng nhập lại.'

                : ' Vai trò mới sẽ áp dụng đầy đủ sau khi tài khoản đó đăng nhập lại.';


        const confirmed =
            await confirmAction(
                `Đổi vai trò của ${target.fullName || target.email} từ ${currentLabel} thành ${nextLabel}?${warning}`,
                {
                    title:
                        'Xác nhận thay đổi vai trò',

                    confirmText:
                        'Đổi vai trò'
                }
            );


        if (!confirmed) {
            /*
             * Nạp lại để select chắc chắn
             * trở về giá trị hiện tại.
             */
            await load();
            return;
        }


        setRoleUpdatingId(
            target.id
        );


        try {
            await api(
                `/api/users/${target.id}/role?role=${nextRole}`,
                {
                    method: 'PATCH'
                }
            );


            await load();


            showSuccess(
                `Đã đổi vai trò thành ${nextLabel}. Tài khoản đó cần đăng nhập lại để quyền mới có hiệu lực đầy đủ.`
            );

        } catch (error) {
            showError(
                error.message
            );


            await load();

        } finally {
            setRoleUpdatingId(
                null
            );
        }
    }


    async function openUserQr(target) {
        setUserQr({
            loading: true,
            target,
            url: ''
        });


        try {
            const url =
                await QRCode.toDataURL(
                    String(
                        target.id
                    ),
                    {
                        errorCorrectionLevel:
                            'M',

                        margin:
                            1,

                        width:
                            360
                    }
                );


            setUserQr({
                loading:
                    false,

                target,

                url,

                fileName:
                    `user-${target.memberCode || target.id}-qr.png`
            });

        } catch (error) {
            showError(
                error.message
            );


            setUserQr(
                null
            );
        }
    }


    function closeUserQr() {
        setUserQr(
            null
        );
    }


    function downloadUserQr() {
        if (!userQr?.url) {
            return;
        }


        const link =
            document.createElement(
                'a'
            );


        link.href =
            userQr.url;


        link.download =
            userQr.fileName;


        document.body.appendChild(
            link
        );


        link.click();
        link.remove();
    }


    function printUserQr() {
        if (!userQr?.url) {
            return;
        }


        const preview =
            window.open(
                '',
                '_blank',
                'width=640,height=760'
            );


        if (!preview) {
            showError(
                'Trình duyệt đang chặn cửa sổ in.'
            );

            return;
        }


        preview.document.title =
            userQr.target.fullName ||
            'Thẻ độc giả';


        const style =
            preview.document
                .createElement(
                    'style'
                );


        style.textContent = `
            body {
                margin: 0;

                min-height: 100vh;

                display: grid;

                place-items: center;

                background: #f6f8f7;

                font-family: sans-serif;
            }

            img {
                width: 360px;

                max-width: 80vw;

                padding: 24px;

                border:
                    1px solid
                    #dbe3df;

                border-radius:
                    24px;

                background:
                    #fff;

                box-shadow:
                    0
                    18px
                    40px
                    rgba(
                        0,
                        0,
                        0,
                        .12
                    );
            }
        `;


        const image =
            preview.document
                .createElement(
                    'img'
                );


        image.src =
            userQr.url;


        image.alt =
            'QR độc giả';


        preview.document.head
            .appendChild(
                style
            );


        preview.document.body
            .appendChild(
                image
            );


        image.onload = () => {
            preview.focus();
            preview.print();
        };
    }


    const normalizedQuery =
        query
            .trim()
            .toLowerCase();


    const rows =
        users.filter(
            target => {
                if (
                    !normalizedQuery
                ) {
                    return true;
                }


                return (
                    `${target.fullName || ''} ` +
                    `${target.email || ''} ` +
                    `${target.memberCode || ''}`
                )
                    .toLowerCase()
                    .includes(
                        normalizedQuery
                    );
            }
        );


    return (
        <AdminShell
            title={
                isAdmin
                    ? 'Tài khoản & phân quyền'
                    : 'Danh bạ độc giả'
            }

            subtitle={
                isAdmin

                    ? 'Quản lý vai trò, trạng thái và hồ sơ người dùng.'

                    : 'Tra cứu thông tin độc giả để hỗ trợ nghiệp vụ tại quầy.'
            }

            toolbar={(
                <div className="admin-toolbar users-toolbar">

                    <div className="searchbox">

                        <Search />


                        <input
                            value={
                                query
                            }

                            onChange={
                                event =>
                                    setQuery(
                                        event.target.value
                                    )
                            }

                            placeholder="Tên, email hoặc mã độc giả..."
                        />


                        {query && (
                            <button
                                type="button"

                                className="search-clear"

                                onClick={
                                    () =>
                                        setQuery('')
                                }

                                aria-label="Xóa nội dung tìm kiếm"
                            >
                                <X />
                            </button>
                        )}

                    </div>


                    <span>
                        {rows.length}
                        {' '}
                        tài khoản
                    </span>

                </div>
            )}
        >

            <div className="panel users-panel">

                <div className="table-wrap users-table-wrap">

                    <table
                        className="users-table"

                        aria-label="Danh sách tài khoản"
                    >

                        <colgroup>
                            <col />
                            <col />
                            <col />
                            <col />
                            <col />
                            <col />
                            <col />
                        </colgroup>


                        <thead>

                        <tr>

                            <th scope="col">
                                Thành viên
                            </th>

                            <th scope="col">
                                Mã
                            </th>

                            <th scope="col">
                                Liên hệ
                            </th>

                            <th scope="col">
                                Ngày tham gia
                            </th>

                            <th scope="col">
                                Vai trò
                            </th>

                            <th scope="col">
                                Trạng thái
                            </th>

                            <th scope="col">
                                Thao tác
                            </th>

                        </tr>

                        </thead>


                        <tbody>

                        {rows.map(
                            target => {

                                const self =
                                    isCurrentAccount(
                                        target
                                    );


                                const roleBusy =
                                    roleUpdatingId ===
                                    target.id;


                                const statusBusy =
                                    statusUpdatingId ===
                                    target.id;


                                return (
                                    <tr
                                        key={
                                            target.id
                                        }
                                    >

                                        <td data-label="Thành viên">

                                            <div className="user-cell users-user-cell">

                                                    <span className="avatar">
                                                        {
                                                            (
                                                                target.fullName ||
                                                                '?'
                                                            )
                                                                .charAt(
                                                                    0
                                                                )
                                                        }
                                                    </span>


                                                <span className="users-user-copy">

                                                        <b
                                                            title={
                                                                target.fullName ||
                                                                ''
                                                            }
                                                        >
                                                            {
                                                                target.fullName ||
                                                                'Chưa cập nhật tên'
                                                            }
                                                        </b>


                                                        <small
                                                            title={
                                                                target.email ||
                                                                ''
                                                            }
                                                        >
                                                            {
                                                                target.email
                                                            }
                                                        </small>


                                                    {self && (
                                                        <small className="users-self-note">
                                                            Tài khoản đang đăng nhập
                                                        </small>
                                                    )}

                                                    </span>

                                            </div>

                                        </td>


                                        <td data-label="Mã">

                                            <b
                                                className="users-code"

                                                title={
                                                    target.memberCode ||
                                                    ''
                                                }
                                            >
                                                {
                                                    target.memberCode ||
                                                    '—'
                                                }
                                            </b>

                                        </td>


                                        <td data-label="Liên hệ">

                                            <div className="users-contact">

                                                    <span>
                                                        {
                                                            target.phone ||
                                                            '—'
                                                        }
                                                    </span>


                                                <small
                                                    title={
                                                        target.address ||
                                                        ''
                                                    }
                                                >
                                                    {
                                                        target.address ||
                                                        'Chưa cập nhật'
                                                    }
                                                </small>

                                            </div>

                                        </td>


                                        <td data-label="Ngày tham gia">
                                            {
                                                date(
                                                    target.createdAt
                                                )
                                            }
                                        </td>


                                        <td data-label="Vai trò">

                                            {isAdmin ? (

                                                <select
                                                    className="user-role-select"

                                                    value={
                                                        target.role
                                                    }

                                                    disabled={
                                                        self ||
                                                        roleBusy
                                                    }

                                                    onChange={
                                                        event =>
                                                            changeRole(
                                                                target,
                                                                event.target.value
                                                            )
                                                    }

                                                    aria-label={
                                                        `Vai trò của ${target.fullName || target.email}`
                                                    }

                                                    title={
                                                        self

                                                            ? 'Không thể thay đổi vai trò của chính tài khoản đang đăng nhập'

                                                            : 'Thay đổi vai trò'
                                                    }
                                                >

                                                    <option value="MEMBER">
                                                        Độc giả
                                                    </option>

                                                    <option value="LIBRARIAN">
                                                        Thủ thư
                                                    </option>

                                                    <option value="ADMIN">
                                                        Quản trị viên
                                                    </option>

                                                </select>

                                            ) : (

                                                <Status>
                                                    {
                                                        roleLabel(
                                                            target.role
                                                        )
                                                    }
                                                </Status>

                                            )}

                                        </td>


                                        <td data-label="Trạng thái">

                                            <Status>
                                                {
                                                    target.status
                                                }
                                            </Status>

                                        </td>


                                        <td data-label="Thao tác">

                                            <div className="row-actions users-actions">

                                                <button
                                                    type="button"

                                                    aria-label="Xem hoặc in QR thẻ độc giả"

                                                    title="QR thẻ độc giả"

                                                    onClick={
                                                        () =>
                                                            openUserQr(
                                                                target
                                                            )
                                                    }
                                                >
                                                    <QrCode />
                                                </button>


                                                <button
                                                    type="button"

                                                    aria-label="Xem hồ sơ"

                                                    title="Xem hồ sơ"

                                                    onClick={
                                                        () =>
                                                            setView(
                                                                target
                                                            )
                                                    }
                                                >
                                                    <Eye />
                                                </button>


                                                {isAdmin && (

                                                    <button
                                                        type="button"

                                                        aria-label={
                                                            target.status ===
                                                            'ACTIVE'

                                                                ? 'Khóa tài khoản'

                                                                : 'Mở khóa tài khoản'
                                                        }

                                                        title={
                                                            self

                                                                ? 'Không thể khóa tài khoản đang đăng nhập'

                                                                : target.status ===
                                                                'ACTIVE'

                                                                    ? 'Khóa tài khoản'

                                                                    : 'Mở khóa tài khoản'
                                                        }

                                                        disabled={
                                                            self ||
                                                            statusBusy
                                                        }

                                                        onClick={
                                                            () =>
                                                                changeStatus(
                                                                    target
                                                                )
                                                        }
                                                    >

                                                        {
                                                            target.status ===
                                                            'ACTIVE'

                                                                ? <Lock />

                                                                : <Unlock />
                                                        }

                                                    </button>

                                                )}

                                            </div>

                                        </td>

                                    </tr>
                                );
                            }
                        )}

                        </tbody>

                    </table>

                </div>


                {!rows.length && (
                    <Empty />
                )}

            </div>


            {userQr && (

                <Modal
                    title={
                        userQr.loading

                            ? 'Đang tải thẻ độc giả'

                            : `Thẻ độc giả: ${userQr.target.fullName}`
                    }

                    onClose={
                        closeUserQr
                    }

                    wide
                >

                    <div className="qr-modal">

                        <div className="qr-preview">

                            {userQr.loading ? (

                                <div className="loading">
                                    Đang tải QR...
                                </div>

                            ) : (

                                <img
                                    src={
                                        userQr.url
                                    }

                                    alt="QR độc giả"
                                />

                            )}

                        </div>


                        <div className="qr-meta">

                            <h3>
                                {
                                    userQr.target.fullName
                                }
                            </h3>


                            <p>
                                Mã độc giả:
                                {' '}

                                <b>
                                    {
                                        userQr.target.memberCode
                                    }
                                </b>
                            </p>


                            <p>
                                Thẻ QR này dùng để quét tại quầy mượn/trả nhanh.
                            </p>


                            <div className="modal-actions qr-actions">

                                <button
                                    type="button"

                                    className="btn btn-outline"

                                    onClick={
                                        downloadUserQr
                                    }

                                    disabled={
                                        !userQr.url
                                    }
                                >
                                    <Download />
                                    Tải xuống
                                </button>


                                <button
                                    type="button"

                                    className="btn btn-outline"

                                    onClick={
                                        printUserQr
                                    }

                                    disabled={
                                        !userQr.url
                                    }
                                >
                                    <Printer />
                                    In thẻ
                                </button>


                                <button
                                    type="button"

                                    className="btn btn-ghost"

                                    onClick={
                                        closeUserQr
                                    }
                                >
                                    Đóng
                                </button>

                            </div>

                        </div>

                    </div>

                </Modal>

            )}


            {view && (

                <Modal
                    title="Hồ sơ thành viên"

                    onClose={
                        () =>
                            setView(
                                null
                            )
                    }
                >

                    <div className="user-profile-modal">

                        <span className="avatar huge">
                            {
                                (
                                    view.fullName ||
                                    '?'
                                )
                                    .charAt(
                                        0
                                    )
                            }
                        </span>


                        <h2>
                            {
                                view.fullName ||
                                'Chưa cập nhật tên'
                            }
                        </h2>


                        <Status>
                            {
                                roleLabel(
                                    view.role
                                )
                            }
                        </Status>


                        <dl>

                            <dt>
                                Mã thành viên
                            </dt>

                            <dd>
                                {
                                    view.memberCode
                                }
                            </dd>


                            <dt>
                                Email
                            </dt>

                            <dd>
                                {
                                    view.email
                                }
                            </dd>


                            <dt>
                                Số điện thoại
                            </dt>

                            <dd>
                                {
                                    view.phone ||
                                    'Chưa cập nhật'
                                }
                            </dd>


                            <dt>
                                Địa chỉ
                            </dt>

                            <dd>
                                {
                                    view.address ||
                                    'Chưa cập nhật'
                                }
                            </dd>


                            <dt>
                                Ngày tham gia
                            </dt>

                            <dd>
                                {
                                    date(
                                        view.createdAt
                                    )
                                }
                            </dd>


                            <dt>
                                Trạng thái
                            </dt>

                            <dd>
                                <Status>
                                    {
                                        view.status
                                    }
                                </Status>
                            </dd>

                        </dl>

                    </div>

                </Modal>

            )}

        </AdminShell>
    );
}